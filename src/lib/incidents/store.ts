import fs from "node:fs";
import path from "node:path";
import {
  VoiceIncidentEvidenceSchema,
} from "@/lib/evidence/types";
import { isDemoSubmissionIncident } from "@/lib/demo/submission-incidents";
import { isFailedChatEvidence } from "@/lib/incidents/failures";
import { isImportedEvidence } from "@/lib/incidents/imported";
import {
  IncidentRecord,
  IncidentSummary,
  InvestigationRun,
} from "@/lib/incidents/types";
const incidents = new Map<string, IncidentRecord>();

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

}

function nowIso() {
  return new Date().toISOString();
}

function loadFixtureFile(fixturePath: string) {
  const raw = fs.readFileSync(fixturePath, "utf8");
  return VoiceIncidentEvidenceSchema.parse(JSON.parse(raw));
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

export function listIncidents(): IncidentSummary[] {
  seedIfEmpty();
  mergeMissingIncidentsFromDisk();
  seedFromDisk();

  return Array.from(incidents.values())
    .filter(
      (incident) =>
        isDemoSubmissionIncident(incident.id) ||
        isImportedEvidence(incident.evidence) ||
        isFailedChatEvidence(incident.evidence),
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

export function cacheIncidentRecord(record: IncidentRecord): IncidentRecord {
  incidents.set(record.id, record);
  return record;
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
  return created;
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
