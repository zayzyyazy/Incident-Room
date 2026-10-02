import { Collection } from "mongodb";
import { VoiceIncidentEvidence, VoiceIncidentEvidenceSchema } from "@/lib/evidence/types";
import { IncidentRecord } from "@/lib/incidents/types";
import { getMongoDb } from "@/lib/mongodb";
import { INCIDENTS_COLLECTION, isMongoConfigured } from "@/lib/mongodb/config";

type ImportedIncidentDocument = {
  incidentId?: string;
  incident_id?: string;
  evidence: VoiceIncidentEvidence;
  status?: IncidentRecord["status"];
  createdAt?: string;
  updatedAt?: string;
  lastRoomId?: string;
  investigations?: IncidentRecord["investigations"];
  source?: "imported_incident";
};

function nowIso() {
  return new Date().toISOString();
}

function importedCollection(): Promise<Collection<ImportedIncidentDocument>> {
  return getMongoDb().then((db) =>
    db.collection<ImportedIncidentDocument>(INCIDENTS_COLLECTION),
  );
}

function recordFromDocument(document: ImportedIncidentDocument): IncidentRecord {
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

function safeRecordFromDocument(document: ImportedIncidentDocument) {
  try {
    return recordFromDocument(document);
  } catch (error) {
    console.warn("Skipping malformed imported incident document", error);
    return null;
  }
}

export function isImportedEvidence(evidence: VoiceIncidentEvidence): boolean {
  const layer = evidence.layer3_customer?._import;
  return Boolean(layer && typeof layer === "object");
}

export async function persistImportedIncidentEvidence(
  evidence: VoiceIncidentEvidence,
) {
  if (!isMongoConfigured() || !isImportedEvidence(evidence)) {
    return null;
  }

  const parsed = VoiceIncidentEvidenceSchema.parse(evidence);
  const collection = await importedCollection();
  const timestamp = nowIso();

  await collection.updateOne(
    { incidentId: parsed.incident_id },
    {
      $set: {
        incidentId: parsed.incident_id,
        evidence: parsed,
        status: "pending",
        updatedAt: timestamp,
        source: "imported_incident",
      },
      $setOnInsert: {
        createdAt: timestamp,
        investigations: [],
      },
    },
    { upsert: true },
  );

  return `mongodb://${INCIDENTS_COLLECTION}/${parsed.incident_id}`;
}

export async function persistImportedIncidentRecordIfNeeded(
  record: IncidentRecord | undefined,
) {
  if (!record || !isMongoConfigured() || !isImportedEvidence(record.evidence)) {
    return;
  }

  const collection = await importedCollection();
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
        source: "imported_incident",
      },
      $setOnInsert: {
        createdAt: record.createdAt,
      },
    },
    { upsert: true },
  );
}

export async function listImportedIncidents(): Promise<IncidentRecord[]> {
  if (!isMongoConfigured()) {
    return [];
  }

  const collection = await importedCollection();
  const documents = await collection.find({}).sort({ updatedAt: -1 }).toArray();

  return documents
    .map(safeRecordFromDocument)
    .filter((record): record is IncidentRecord => record !== null);
}

export async function getImportedIncident(
  incidentId: string,
): Promise<IncidentRecord | undefined> {
  if (!isMongoConfigured()) {
    return undefined;
  }

  const collection = await importedCollection();
  const document =
    (await collection.findOne({ incidentId })) ??
    (await collection.findOne({ "evidence.incident_id": incidentId })) ??
    (await collection.findOne({ incident_id: incidentId }));
  const record = document ? safeRecordFromDocument(document) : null;
  return record ?? undefined;
}
