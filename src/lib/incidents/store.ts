import fs from "node:fs";
import path from "node:path";
import { VoiceIncidentEvidenceSchema } from "@/lib/evidence/types";
import {
  IncidentRecord,
  IncidentSummary,
  InvestigationRun,
} from "@/lib/incidents/types";

const incidents = new Map<string, IncidentRecord>();

function nowIso() {
  return new Date().toISOString();
}

function loadSeedFixture() {
  const fixturePath = path.join(
    process.cwd(),
    "fixtures",
    "hero-klaus-minimal.json",
  );
  const raw = fs.readFileSync(fixturePath, "utf8");
  return VoiceIncidentEvidenceSchema.parse(JSON.parse(raw));
}

function seedIfEmpty() {
  if (incidents.size > 0) {
    return;
  }

  const evidence = loadSeedFixture();
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

export function listIncidents(): IncidentSummary[] {
  seedIfEmpty();

  return Array.from(incidents.values())
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
  return incidents.get(id);
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
