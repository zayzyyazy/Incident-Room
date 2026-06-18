import fs from "node:fs";
import path from "node:path";
import {
  VoiceIncidentEvidence,
  VoiceIncidentEvidenceSchema,
} from "@/lib/evidence/types";
import { isDemoSubmissionIncident } from "@/lib/demo/submission-incidents";
import {
  IncidentRecord,
  IncidentSummary,
  InvestigationRun,
} from "@/lib/incidents/types";
const incidents = new Map<string, IncidentRecord>();
const FAILED_CHAT_FILE_PREFIX = "failed-chat-";

const DATA_DIR = path.join(process.cwd(), ".data");
const IMPORTED_INCIDENTS_PATH = path.join(DATA_DIR, "imported-incidents.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadImportedEvidenceFromDisk(): Array<
  ReturnType<typeof VoiceIncidentEvidenceSchema.parse>
> {
  ensureDataDir();
  if (!fs.existsSync(IMPORTED_INCIDENTS_PATH)) {
    return [];
  }

  try {
    const raw = JSON.parse(fs.readFileSync(IMPORTED_INCIDENTS_PATH, "utf8")) as {
      incidents?: unknown[];
    };
    return (raw.incidents ?? []).map((item) =>
      VoiceIncidentEvidenceSchema.parse(item),
    );
  } catch {
    return [];
  }
}

function persistImportedEvidence(
  evidence: ReturnType<typeof VoiceIncidentEvidenceSchema.parse>,
) {
  ensureDataDir();
  const existing = loadImportedEvidenceFromDisk();
  const index = existing.findIndex((e) => e.incident_id === evidence.incident_id);
  const next =
    index === -1
      ? [...existing, evidence]
      : existing.map((e, i) => (i === index ? evidence : e));

  fs.writeFileSync(
    IMPORTED_INCIDENTS_PATH,
    JSON.stringify({ incidents: next }, null, 2),
    "utf8",
  );
}

function mergeMissingIncidentsFromDisk() {
  for (const fixturePath of fixturePathsOnDisk()) {
    try {
      const evidence = loadFixtureFile(fixturePath);
      if (!incidents.has(evidence.incident_id)) {
        upsertFromEvidenceFile(fixturePath);
      }
    } catch {
      // skip invalid fixture files
    }
  }

  for (const evidence of loadImportedEvidenceFromDisk()) {
    if (!incidents.has(evidence.incident_id)) {
      const timestamp = nowIso();
      incidents.set(evidence.incident_id, {
        id: evidence.incident_id,
        evidence,
        status: "pending",
        createdAt: timestamp,
        updatedAt: timestamp,
        investigations: [],
      });
    }
  }
}

function nowIso() {
  return new Date().toISOString();
}

function loadFixtureFile(fixturePath: string) {
  const raw = fs.readFileSync(fixturePath, "utf8");
  return VoiceIncidentEvidenceSchema.parse(JSON.parse(raw));
}

function sanitizeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
}

function failedChatEvidencePath(evidence: VoiceIncidentEvidence) {
  return path.join(
    process.cwd(),
    `${FAILED_CHAT_FILE_PREFIX}${sanitizeFilePart(evidence.incident_id)}.json`,
  );
}

function fixturePathsOnDisk(): string[] {
  const roots = [
    path.join(process.cwd(), "fixtures"),
    path.join(process.cwd(), "fixtures", "seeded"),
    path.join(process.cwd(), "fixtures", "incidents"),
  ];

  const paths: string[] = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) {
      continue;
    }
    for (const entry of fs.readdirSync(root)) {
      if (entry.endsWith(".json")) {
        paths.push(path.join(root, entry));
      }
    }
  }

  for (const entry of fs.readdirSync(process.cwd())) {
    if (entry.startsWith(FAILED_CHAT_FILE_PREFIX) && entry.endsWith(".json")) {
      paths.push(path.join(process.cwd(), entry));
    }
  }

  return paths;
}

function upsertFromEvidenceFile(
  fixturePath: string,
  preserveInvestigations?: InvestigationRun[],
): IncidentRecord {
  const evidence = loadFixtureFile(fixturePath);
  const existing = incidents.get(evidence.incident_id);
  const timestamp = nowIso();

  const record: IncidentRecord = {
    id: evidence.incident_id,
    evidence,
    status: existing?.status ?? "pending",
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    lastRoomId: existing?.lastRoomId,
    investigations: preserveInvestigations ?? existing?.investigations ?? [],
  };

  incidents.set(evidence.incident_id, record);
  return record;
}

function seedFromDisk() {
  for (const fixturePath of fixturePathsOnDisk()) {
    try {
      const evidence = loadFixtureFile(fixturePath);
      if (!incidents.has(evidence.incident_id)) {
        upsertFromEvidenceFile(fixturePath);
      }
    } catch {
      // Skip non-evidence JSON (e.g. crm/customers.json lives elsewhere)
    }
  }
}

function seedIfEmpty() {
  if (incidents.size === 0) {
    seedFromDisk();
  }
}

function loadIncidentFromDisk(id: string): IncidentRecord | undefined {
  for (const fixturePath of fixturePathsOnDisk()) {
    try {
      const evidence = loadFixtureFile(fixturePath);
      if (evidence.incident_id === id) {
        return upsertFromEvidenceFile(fixturePath);
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

function isImportedIncident(
  evidence: ReturnType<typeof VoiceIncidentEvidenceSchema.parse>,
): boolean {
  const layer = evidence.layer3_customer?._import;
  return Boolean(layer && typeof layer === "object");
}

function isFailedChatIncident(
  evidence: ReturnType<typeof VoiceIncidentEvidenceSchema.parse>,
): boolean {
  return (
    evidence.incident_id.startsWith("CHAT-") &&
    evidence.source_platform === "synthetic" &&
    evidence.title.toLowerCase().startsWith("failed chat")
  );
}

export function listIncidents(): IncidentSummary[] {
  seedIfEmpty();
  mergeMissingIncidentsFromDisk();
  seedFromDisk();

  return Array.from(incidents.values())
    .filter(
      (incident) =>
        isDemoSubmissionIncident(incident.id) ||
        isImportedIncident(incident.evidence) ||
        isFailedChatIncident(incident.evidence),
    )
    .map((incident) => {
      const last = incident.investigations.at(-1);
      return {
        id: incident.id,
        title: incident.evidence.title,
        source_platform: incident.evidence.source_platform,
        status: incident.status,
        updatedAt: incident.updatedAt,
        investigationCount: incident.investigations.length,
        lastVerdict: last?.conversationAnalysis?.conversation_verdict,
        lastExecutionVerdict: last?.outcomeAnalysis?.execution_verdict,
        lastCause: last?.causeRoom?.causeFinding.cause,
        lastCauseClass: last?.causeRoom?.causeFinding.cause_class,
        lastRoomId: incident.lastRoomId ?? last?.roomId,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
}

export function getIncident(id: string): IncidentRecord | undefined {
  seedIfEmpty();
  mergeMissingIncidentsFromDisk();

  seedFromDisk();
  const cached = incidents.get(id);
  if (cached) {
    return cached;
  }

  return loadIncidentFromDisk(id);
}

export function upsertIncidentFromEvidence(
  evidence: ReturnType<typeof VoiceIncidentEvidenceSchema.parse>,
): IncidentRecord {
  seedIfEmpty();

  const existing = incidents.get(evidence.incident_id);
  const timestamp = nowIso();

  if (existing) {
    const updated: IncidentRecord = {
      ...existing,
      evidence,
      updatedAt: timestamp,
    };
    incidents.set(evidence.incident_id, updated);
    persistImportedEvidence(evidence);
    return updated;
  }

  const created: IncidentRecord = {
    id: evidence.incident_id,
    evidence,
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
    investigations: [],
  };

  incidents.set(evidence.incident_id, created);
  persistImportedEvidence(evidence);
  return created;
}

export function persistFailedChatEvidence(evidence: VoiceIncidentEvidence) {
  const parsed = VoiceIncidentEvidenceSchema.parse(evidence);
  const filePath = failedChatEvidencePath(parsed);
  fs.writeFileSync(filePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  return filePath;
}

export function startInvestigation(incidentId: string): InvestigationRun {
  const incident = getIncident(incidentId);
  if (!incident) {
    throw new Error(`Incident not found: ${incidentId}`);
  }

  const run: InvestigationRun = {
    id: `run-${Date.now()}`,
    startedAt: nowIso(),
    status: "running",
    pipeline: "full",
  };

  incident.investigations.push(run);
  incident.status = "investigating";
  incident.updatedAt = nowIso();
  incidents.set(incidentId, incident);

  return run;
}

export function completeInvestigation(
  incidentId: string,
  runId: string,
  result: Omit<InvestigationRun, "id" | "startedAt" | "status">,
): InvestigationRun {
  const incident = getIncident(incidentId);
  if (!incident) {
    throw new Error(`Incident not found: ${incidentId}`);
  }

  const index = incident.investigations.findIndex((r) => r.id === runId);
  if (index === -1) {
    throw new Error(`Investigation run not found: ${runId}`);
  }

  const completed: InvestigationRun = {
    ...incident.investigations[index],
    ...result,
    status: "complete",
    completedAt: nowIso(),
  };

  incident.investigations[index] = completed;
  incident.status = "complete";
  incident.lastRoomId = completed.roomId;
  if (completed.crmLink) {
    incident.crmLink = completed.crmLink;
  }
  if (completed.crmLookup) {
    incident.lastCrmLookup = completed.crmLookup;
  }
  incident.updatedAt = nowIso();
  incidents.set(incidentId, incident);

  return completed;
}

export function failInvestigation(
  incidentId: string,
  runId: string,
  error: string,
): InvestigationRun {
  const incident = getIncident(incidentId);
  if (!incident) {
    throw new Error(`Incident not found: ${incidentId}`);
  }

  const index = incident.investigations.findIndex((r) => r.id === runId);
  if (index === -1) {
    throw new Error(`Investigation run not found: ${runId}`);
  }

  const failed: InvestigationRun = {
    ...incident.investigations[index],
    status: "failed",
    completedAt: nowIso(),
    error,
  };

  incident.investigations[index] = failed;
  incident.status = "failed";
  incident.updatedAt = nowIso();
  incidents.set(incidentId, incident);

  return failed;
}
