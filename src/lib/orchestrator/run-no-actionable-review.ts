import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { ImportAssessment } from "@/lib/normalizer/leaping-import";
import { IncidentReport } from "@/lib/reality/types";
import { InvestigationStep } from "@/lib/demo/investigation-steps";
import { routeEvidence } from "@/lib/normalizer/route-evidence";
import { runEvidenceNormalizer } from "@/lib/normalizer/run-normalizer";

function readAssessment(evidence: VoiceIncidentEvidence): ImportAssessment | null {
  const imp = evidence.layer3_customer?._import;
  if (!imp || typeof imp !== "object") return null;
  const assessment = (imp as Record<string, unknown>).assessment;
  if (!assessment || typeof assessment !== "object") return null;
  return assessment as ImportAssessment;
}

export function shouldSkipFullInvestigation(
  evidence: VoiceIncidentEvidence,
): ImportAssessment | null {
  const assessment = readAssessment(evidence);
  if (assessment?.outcome === "no_actionable_incident") {
    return assessment;
  }
  return null;
}

export function buildNoActionableIncidentReport(
  evidence: VoiceIncidentEvidence,
  assessment: ImportAssessment,
): IncidentReport {
  const successTools = evidence.layer2_execution.function_calls.filter(
    (c) => c.status === "success",
  );
  const customerTurns = evidence.layer1_conversation.segments.filter(
    (s) => s.speaker === "customer",
  ).length;

  return {
    type: "IncidentReport",
    finding: "No actionable incident in captured trace",
    customer_impact:
      customerTurns === 0
        ? "No customer speech captured in this export — only agent greeting / setup tools ran."
        : `Customer spoke ${customerTurns} time(s), but no failed tools were captured.`,
    system_reality:
      successTools.length > 0
        ? `${successTools.length} tool call(s) succeeded (${successTools.map((t) => t.name).join(", ")}).`
        : "No tool calls captured.",
    failed_theories: [],
    surviving_explanation: assessment.reason,
    fix_target: "No code change indicated from this export alone",
    fix_detail:
      "Re-import when the call includes customer speech, a failed tool, or a completed conversation with a promise/side-effect mismatch.",
    cause_room_finding: "INSUFFICIENT_EVIDENCE — no failure established.",
    architecture_room_finding: "Skipped — no incident signal to localize.",
    reconciliation: assessment.reason,
  };
}

export async function runNoActionableReview(input: {
  evidence: VoiceIncidentEvidence;
  assessment: ImportAssessment;
  onStep?: (step: InvestigationStep) => void | Promise<void>;
}) {
  const routed = routeEvidence({ evidence: input.evidence });
  await runEvidenceNormalizer({
    evidence: input.evidence,
    postToBand: false,
    onStep: input.onStep,
  });

  const steps: InvestigationStep[] = [];
  const push = async (step: Omit<InvestigationStep, "index">) => {
    const full = { ...step, index: steps.length };
    steps.push(full);
    await input.onStep?.(full);
  };

  await push({
    id: "no-actionable-1",
    room: "normalizer",
    agentId: "evidence_normalizer",
    agentShort: "NR",
    agentLabel: "Evidence Router",
    phase: "normalizer",
    headline: "Import assessment",
    line: input.assessment.reason,
    kind: "NormalizerRouting",
    messageId: `no-actionable-${input.evidence.incident_id}`,
  });

  await push({
    id: "no-actionable-2",
    room: "cause",
    agentId: "causal_judge",
    agentShort: "CJ",
    agentLabel: "Causal Judge",
    phase: "complete",
    headline: "No incident to prosecute",
    line: "All captured tools succeeded and no customer harm signal is present. Full Cause + Architecture investigation skipped.",
    kind: "CauseDefenseDecision",
    messageId: `no-actionable-cj-${input.evidence.incident_id}`,
  });

  const report = buildNoActionableIncidentReport(input.evidence, input.assessment);

  return {
    routed,
    report,
    steps,
    roomId: undefined as string | undefined,
  };
}
