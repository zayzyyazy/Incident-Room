import { InvestigationRun } from "@/lib/incidents/types";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { buildTheoryScriptForEvidence } from "@/lib/reality/build-theory-script";
import { IncidentReport, shouldUseTheoryInvestigation } from "@/lib/reality/types";
import { InvestigationStep } from "@/lib/demo/investigation-steps";

export type IncidentReportView = {
  finding: string;
  customerImpact: string;
  systemReality: string;
  failedTheories: { label: string; reason: string }[];
  survivingExplanation: string;
  fixTarget: string;
  fixDetail?: string;
  causeRoomFinding?: string;
  architectureRoomFinding?: string;
  reconciliation?: string;
  collaborationHighlights?: { kind: string; agent_label: string; line: string }[];
};

export type TheoryConflictBeat = {
  kind: string;
  agentId: string;
  agentLabel: string;
  line: string;
  highlight?: boolean;
};

export type TheoryConflictView = { show: boolean; beats: TheoryConflictBeat[] };

/** @deprecated */
export type RealityCollisionView = TheoryConflictView;

export function buildIncidentReportView(
  evidence: VoiceIncidentEvidence,
  run?: InvestigationRun | null,
): IncidentReportView {
  const report = run?.realityCollision?.incidentReport;
  if (report) {
    return mapReport(report);
  }

  if (shouldUseTheoryInvestigation(evidence.incident_id, evidence)) {
    return mapReport(buildTheoryScriptForEvidence(evidence).report);
  }

  return {
    finding: "Investigation incomplete",
    customerImpact: "—",
    systemReality: "—",
    failedTheories: [],
    survivingExplanation: "—",
    fixTarget: "—",
  };
}

function mapReport(report: IncidentReport): IncidentReportView {
  return {
    finding: report.finding,
    customerImpact: report.customer_impact,
    systemReality: report.system_reality,
    failedTheories: report.failed_theories,
    survivingExplanation: report.surviving_explanation,
    fixTarget: report.fix_target,
    fixDetail: report.fix_detail,
    causeRoomFinding: report.cause_room_finding,
    architectureRoomFinding: report.architecture_room_finding,
    reconciliation: report.reconciliation,
    collaborationHighlights: report.collaboration_highlights,
  };
}

export function buildTheoryConflictView(
  run?: InvestigationRun | null,
  steps?: InvestigationStep[],
): { show: boolean; beats: TheoryConflictBeat[] } {
  const timeline = run?.stepTimeline?.length
    ? run.stepTimeline
    : steps ?? [];

  const theoryKinds = new Set([
    "TheoryOpening",
    "TheoryChallenge",
    "TheoryWithdrawal",
    "TheoryCounter",
    "TheorySynthesis",
    "IncidentFinding",
  ]);

  const collaborationKinds = new Set([
    "agent_challenge",
    "CauseDefenseRequest",
    "investigator_admission",
    "surface_attack",
    "surface_counterattack",
    "NormalizerEvidenceRequest",
    "CauseRevisionRequest",
  ]);

  const beats = timeline
    .filter(
      (s) => theoryKinds.has(s.kind) || collaborationKinds.has(s.kind) || s.line.includes("@"),
    )
    .map((s) => ({
      kind: s.headline,
      agentId: s.agentId,
      agentLabel: s.agentLabel,
      line: s.line,
      highlight:
        s.kind === "TheoryChallenge" ||
        s.kind === "TheoryCounter" ||
        s.kind === "TheoryWithdrawal" ||
        s.kind === "TheorySynthesis" ||
        s.kind === "agent_challenge" ||
        s.kind === "investigator_admission" ||
        s.kind === "surface_attack" ||
        s.kind === "CauseDefenseRequest" ||
        s.line.includes("@"),
    }));

  return { show: beats.length > 0, beats };
}

export function isTheoryInvestigationDemo(evidence: VoiceIncidentEvidence): boolean {
  return shouldUseTheoryInvestigation(evidence.incident_id, evidence);
}

export function bandRoomUrl(roomId?: string): string | undefined {
  if (!roomId) return undefined;
  return `https://app.band.ai/agent/chats/${roomId}`;
}

/** @deprecated */
export type RealityVerdictView = IncidentReportView;
export function buildRealityVerdictView(
  evidence: VoiceIncidentEvidence,
  run?: InvestigationRun | null,
): IncidentReportView {
  return buildIncidentReportView(evidence, run);
}

export function buildRealityCollisionView(run?: InvestigationRun | null) {
  return buildTheoryConflictView(run);
}

export function isRealityCollisionDemo(evidence: VoiceIncidentEvidence): boolean {
  return isTheoryInvestigationDemo(evidence);
}

export function buildInvestigationVerdictView(
  evidence: VoiceIncidentEvidence,
  run?: InvestigationRun | null,
): IncidentReportView {
  return buildIncidentReportView(evidence, run);
}

export function buildTurningPointView(
  evidence: VoiceIncidentEvidence,
  run?: InvestigationRun | null,
) {
  return buildTheoryConflictView(run);
}
