import { Collection } from "mongodb";
import { VoiceIncidentEvidence, VoiceIncidentEvidenceSchema } from "@/lib/evidence/types";
import { IncidentRecord } from "@/lib/incidents/types";
import { FAILURES_COLLECTION, isMongoConfigured } from "@/lib/mongodb/config";
import { getMongoDb } from "@/lib/mongodb";

type FailureDocument = {
  incidentId: string;
  evidence: VoiceIncidentEvidence;
  status: IncidentRecord["status"];
  createdAt: string;
  updatedAt: string;
  lastRoomId?: string;
  investigations: IncidentRecord["investigations"];
  source: "replychat_failure";
};

function nowIso() {
  return new Date().toISOString();
}

function failureRecordFromDocument(document: FailureDocument): IncidentRecord {
  return {
    id: document.incidentId,
    evidence: VoiceIncidentEvidenceSchema.parse(document.evidence),
    status: document.status,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    lastRoomId: document.lastRoomId,
    investigations: document.investigations ?? [],
  };
}

export function isFailedChatEvidence(evidence: VoiceIncidentEvidence) {
  return (
    evidence.incident_id.startsWith("CHAT-") &&
    evidence.source_platform === "synthetic" &&
    evidence.title.toLowerCase().startsWith("failed chat")
  );
}

function isFailedChatRecord(record: IncidentRecord) {
  return isFailedChatEvidence(record.evidence);
}

async function failuresCollection(): Promise<Collection<FailureDocument>> {
  const db = await getMongoDb();
  return db.collection<FailureDocument>(FAILURES_COLLECTION);
}

export async function persistFailedChatEvidence(
  evidence: VoiceIncidentEvidence,
): Promise<string | null> {
  if (!isMongoConfigured()) {
    console.warn("MongoDB is not configured; failed chat was not persisted.");
    return null;
  }

  const parsed = VoiceIncidentEvidenceSchema.parse(evidence);
  const collection = await failuresCollection();
  const timestamp = nowIso();

  await collection.updateOne(
    { incidentId: parsed.incident_id },
    {
      $set: {
        incidentId: parsed.incident_id,
        evidence: parsed,
        status: "pending",
        updatedAt: timestamp,
        source: "replychat_failure",
      },
      $setOnInsert: {
        createdAt: timestamp,
        investigations: [],
      },
    },
    { upsert: true },
  );

  return `mongodb://${FAILURES_COLLECTION}/${parsed.incident_id}`;
}

export async function persistFailureIncidentRecordIfNeeded(
  record: IncidentRecord | undefined,
) {
  if (!record || !isFailedChatRecord(record) || !isMongoConfigured()) {
    return;
  }

  const collection = await failuresCollection();
  await collection.updateOne(
    { incidentId: record.id },
    {
      $set: {
        incidentId: record.id,
        evidence: record.evidence,
        status: record.status,
        updatedAt: record.updatedAt,
        lastRoomId: record.lastRoomId,
        investigations: record.investigations,
        source: "replychat_failure",
      },
      $setOnInsert: {
        createdAt: record.createdAt,
      },
    },
    { upsert: true },
  );
}

export async function listFailureIncidents(): Promise<IncidentRecord[]> {
  if (!isMongoConfigured()) {
    return [];
  }

  const collection = await failuresCollection();
  const documents = await collection
    .find({ source: "replychat_failure" })
    .sort({ updatedAt: -1 })
    .toArray();

  return documents.map(failureRecordFromDocument);
}

export async function getFailureIncident(
  incidentId: string,
): Promise<IncidentRecord | undefined> {
  if (!isMongoConfigured()) {
    return undefined;
  }

  const collection = await failuresCollection();
  const document = await collection.findOne({ incidentId });
  return document ? failureRecordFromDocument(document) : undefined;
}
