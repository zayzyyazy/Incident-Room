import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import {
  agentOutcomeTurn,
  buildFixRecommendation,
  computeVerdict,
  customerBeliefNarrative,
  formatToolFailure,
  primaryFailedTool,
} from "@/lib/investigation/evidence-analysis";
import { VerdictOutcome } from "@/lib/investigation/events";

export type CallOutcomeKind =
  | "misled_customer"
  | "failed_without_clear_promise"
  | "succeeded"
  | "unclear";

export type CallInvestigationFinding = {
  /** Primary human headline — not "NOT JUSTIFIED" */
  headline: string;
  call_outcome: CallOutcomeKind;
  what_happened: string;
  execution_break: string;
  customer_impact: string;
  recommended_actions: string[];
  /** Internal audit enum — secondary */
  technical_verdict: VerdictOutcome;
};

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function buildCallFinding(
  evidence: VoiceIncidentEvidence,
): CallInvestigationFinding {
  const { verdict, failures, agentLine } = computeVerdict(evidence);
  const primary = primaryFailedTool(evidence);
  const agentTurn = agentOutcomeTurn(evidence);
  const belief = customerBeliefNarrative(evidence);
  const fix = buildFixRecommendation(evidence, primary);
  const executionBreak = primary
    ? formatToolFailure(primary)
    : failures[0]
      ? formatToolFailure(failures[0])
      : "No failed mutation recorded in tool trace.";

  const actions = [fix.fix_target, fix.fix_detail].filter(Boolean);

  if (verdict === "JUSTIFIED") {
    return {
      headline: "Call succeeded — backend matches what the agent told the customer",
      call_outcome: "succeeded",
      what_happened: agentTurn
        ? `Agent closure at ${agentTurn.turn_id} aligns with tool trace.`
        : "Tool trace supports the communicated outcome.",
      execution_break: executionBreak,
      customer_impact: belief,
      recommended_actions: ["No remediation required for this incident class."],
      technical_verdict: verdict,
    };
  }

  if (verdict === "INSUFFICIENT_EVIDENCE" && failures.length === 0) {
    return {
      headline: "Call outcome unclear — evidence too thin to call success or failure",
      call_outcome: "unclear",
      what_happened:
        "Transcript and tool trace do not expose a clear mutation failure or a strong agent promise.",
      execution_break: executionBreak,
      customer_impact: belief,
      recommended_actions: [
        "Collect full tool trace and customer confirmation before closing.",
        ...actions,
      ],
      technical_verdict: verdict,
    };
  }

  const toolName = primary?.name ?? "backing mutation";
  const agentSaid = agentTurn
    ? clip(agentTurn.text, 120)
    : clip(agentLine, 120);

  if (agentTurn && failures.length > 0) {
    return {
      headline: `Call failed — customer was told success while ${toolName} broke`,
      call_outcome: "misled_customer",
      what_happened: `Agent: "${agentSaid}" (${agentTurn.turn_id}). Backend: ${executionBreak}.`,
      execution_break: executionBreak,
      customer_impact: belief,
      recommended_actions: actions,
      technical_verdict: verdict,
    };
  }

  if (failures.length > 0) {
    return {
      headline: `Call failed at ${toolName} — execution break without clear customer closure`,
      call_outcome: "failed_without_clear_promise",
      what_happened: `Backend mutation failed: ${executionBreak}.`,
      execution_break: executionBreak,
      customer_impact: belief,
      recommended_actions: actions,
      technical_verdict: verdict,
    };
  }

  return {
    headline: "Call needs more evidence before closing",
    call_outcome: "unclear",
    what_happened: "Specialists could not reconcile transcript and tool trace.",
    execution_break: executionBreak,
    customer_impact: belief,
    recommended_actions: actions,
    technical_verdict: verdict,
  };
}

export function callOutcomeLabel(kind: CallOutcomeKind): string {
  const map: Record<CallOutcomeKind, string> = {
    misled_customer: "Customer misled",
    failed_without_clear_promise: "Execution failed",
    succeeded: "Call succeeded",
    unclear: "Outcome unclear",
  };
  return map[kind];
}
