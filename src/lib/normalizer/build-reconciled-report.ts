import { CauseRoomRunResult, LocalizationRoomRunResult } from "@/lib/incidents/types";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { InvestigationStep } from "@/lib/demo/investigation-steps";
import { IncidentReport } from "@/lib/reality/types";
import { RoutedEvidence } from "@/lib/normalizer/types";
import { hypothesisClassLabel } from "@/lib/cause-room/hypothesis-classes";

export type CollaborationHighlight = {
  kind: string;
  agent_label: string;
  line: string;
};

function customerImpactFromEvidence(evidence: VoiceIncidentEvidence): string {
  const agentTurn = [...evidence.layer1_conversation.segments]
    .reverse()
    .find((s) => s.speaker === "agent");
  if (!agentTurn) return "Customer-facing agent turns present in transcript.";
  return `Customer heard: "${agentTurn.text.slice(0, 160)}${agentTurn.text.length > 160 ? "…" : ""}"`;
}

function systemRealityFromRouted(routed: RoutedEvidence): string {
  const failed = routed.tool_trace_packet.errors[0];
  if (failed) {
    const status = failed.http_status ? ` (${failed.http_status})` : "";
    return `${failed.tool_name} → ${failed.status ?? "error"}${status}`;
  }
  const missing = routed.tool_trace_packet.side_effects.find(
    (s) => s.value === false,
  );
  if (missing) {
    return `Side effect not created: ${missing.key}`;
  }
  return "No verified backend side effect recorded.";
}

function extractCollaborationHighlights(
  steps: InvestigationStep[],
): CollaborationHighlight[] {
  const highlightKinds = new Set([
    "TheoryChallenge",
    "TheoryWithdrawal",
    "TheoryCounter",
    "agent_challenge",
    "CauseDefenseRequest",
    "investigator_admission",
    "surface_attack",
    "surface_counterattack",
    "NormalizerEvidenceRequest",
    "CauseRevisionRequest",
  ]);

  return steps
    .filter((s) => highlightKinds.has(s.kind) || s.line.includes("@"))
    .map((s) => ({
      kind: s.headline,
      agent_label: s.agentLabel,
      line: s.line,
    }));
}

export function buildReconciledIncidentReport(input: {
  evidence: VoiceIncidentEvidence;
  routed: RoutedEvidence;
  cause: CauseRoomRunResult;
  localization?: LocalizationRoomRunResult | null;
  steps?: InvestigationStep[];
}): IncidentReport {
  const causeFinding =
    input.cause.causeFinding?.cause ??
    input.cause.causeFindingArtifact?.cause_statement ??
    "Cause Room did not finalize a finding.";

  const causeClass =
    input.cause.causeFinding?.cause_class ??
    input.cause.causeFindingArtifact?.cause_class;

  const locFinding = input.localization?.localizationFinding;
  const breakthrough = input.localization?.investigationBreakthrough;
  const architectureFinding =
    locFinding?.mechanism_explanation ??
    breakthrough?.human_sentence ??
    "Architecture Room did not finalize a finding.";

  const fixTarget =
    locFinding?.recommended_investigation_target ??
    locFinding?.primary_surface?.pointer?.native_pointer ??
    locFinding?.primary_surface?.surface_id ??
    "Gate customer-facing confirmation on verified tool success.";

  const reconciliation = causeFinding;

  const finding =
    breakthrough?.headline ??
    input.cause.causeFindingArtifact?.cause_statement ??
    (causeClass
      ? hypothesisClassLabel(causeClass)
      : "Incident requires operator review.");

  const failedTheories = (input.cause.causeFinding?.ruled_out ?? [])
    .slice(0, 4)
    .map((r) => {
      const row = r as {
        hypothesis_en?: string;
        ruled_out_by_en?: string;
        hypothesis_class?: string;
      };
      return {
        label:
          row.hypothesis_en ??
          (row.hypothesis_class
            ? hypothesisClassLabel(row.hypothesis_class)
            : "Ruled-out theory"),
        reason: row.ruled_out_by_en ?? "Incomplete under cross-room scrutiny.",
      };
    });

  const collaboration = extractCollaborationHighlights(input.steps ?? []);

  return {
    type: "IncidentReport",
    finding,
    customer_impact: customerImpactFromEvidence(input.evidence),
    system_reality: systemRealityFromRouted(input.routed),
    failed_theories: failedTheories,
    surviving_explanation: reconciliation,
    fix_target: fixTarget,
    fix_detail: architectureFinding,
    cause_room_finding: causeFinding,
    architecture_room_finding: architectureFinding,
    reconciliation,
    collaboration_highlights: collaboration,
  };
}
