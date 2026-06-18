import { Collection } from "mongodb";
import { VoiceIncidentEvidence, VoiceIncidentEvidenceSchema } from "@/lib/evidence/types";
import { IncidentRecord } from "@/lib/incidents/types";
import { FAILURES_COLLECTION, isMongoConfigured } from "@/lib/mongodb/config";
import { getMongoDb } from "@/lib/mongodb";

type FailureDocument = {
  incidentId?: string;
  evidence: VoiceIncidentEvidence;
  status: IncidentRecord["status"];
  createdAt: string;
  updatedAt: string;
  lastRoomId?: string;
  investigations: IncidentRecord["investigations"];
  source: "replychat_failure";
};

type FailureDocumentLike = FailureDocument & {
  incident_id?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function failureRecordFromDocument(document: FailureDocumentLike): IncidentRecord {
  const evidence = VoiceIncidentEvidenceSchema.parse(document.evidence);
  const incidentId = document.incidentId ?? document.incident_id ?? evidence.incident_id;

  return {
    id: incidentId,
    evidence,
    status: document.status ?? "pending",
    createdAt: document.createdAt ?? document.updatedAt ?? nowIso(),
    updatedAt: document.updatedAt ?? document.createdAt ?? nowIso(),
    lastRoomId: document.lastRoomId,
    investigations: document.investigations ?? [],
  };
}

function safeFailureRecordFromDocument(
  document: FailureDocumentLike,
): IncidentRecord | null {
  try {
    const record = failureRecordFromDocument(document);
    return isFailedChatRecord(record) ? record : null;
  } catch (error) {
    console.warn("Skipping malformed failure incident document", error);
    return null;
  }
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
    .find({})
    .sort({ updatedAt: -1 })
    .toArray();

  return documents
    .map((document) => safeFailureRecordFromDocument(document))
    .filter((record): record is IncidentRecord => record !== null);
}

export async function getFailureIncident(
  incidentId: string,
): Promise<IncidentRecord | undefined> {
  if (!isMongoConfigured()) {
    return undefined;
  }

  const collection = await failuresCollection();
  const document =
    (await collection.findOne({ incidentId })) ??
    (await collection.findOne({ "evidence.incident_id": incidentId })) ??
    (await collection.findOne({ incident_id: incidentId }));
  const record = document ? safeFailureRecordFromDocument(document) : null;
  return record ?? undefined;
}
