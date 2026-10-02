import { InvestigationRun } from "@/lib/incidents/types";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { buildTheoryScriptForEvidence } from "@/lib/reality/build-theory-script";
import { IncidentReport, shouldUseTheoryInvestigation } from "@/lib/reality/types";
import { InvestigationStep } from "@/lib/demo/investigation-steps";
import { isLocalBandRoom } from "@/lib/band/client";

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
  const earned = run?.earnedInvestigation?.incidentReport;
  if (earned) return mapReport(earned);

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
    "TheoryProposed",
    "TheorySupported",
    "TheoryRefined",
    "TheoryAccepted",
    "IncidentFinding",
    "SpecialistRecruited",
    "EvidenceRequested",
    "EvidenceReturned",
    "RoomChallenge",
    "ConfidenceChanged",
    "VerdictIssued",
    "ExplanationIssued",
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
        s.kind === "TheoryChallenged" ||
        s.kind === "TheoryProposed" ||
        s.kind === "TheorySupported" ||
        s.kind === "TheoryRefined" ||
        s.kind === "TheoryAccepted" ||
        s.kind === "TheoryCounter" ||
        s.kind === "TheoryWithdrawn" ||
        s.kind === "TheoryWithdrawal" ||
        s.kind === "TheorySynthesis" ||
        s.kind === "SpecialistRecruited" ||
        s.kind === "RoomChallenge" ||
        s.kind === "ConfidenceChanged" ||
        s.kind === "VerdictIssued" ||
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
  if (!roomId || isLocalBandRoom(roomId)) return undefined;
  return `https://app.band.ai/chat/${roomId}`;
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
