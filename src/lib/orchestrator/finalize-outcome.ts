import { OutcomeAnalysis } from "@/lib/band/message-types";
import { FunctionCallSchema } from "@/lib/evidence/types";
import { applyContradictionFallback } from "@/lib/orchestrator/contradiction";
import { classifyResolutionPath } from "@/lib/orchestrator/handoff-classifier";
import { z } from "zod";

type FunctionCall = z.infer<typeof FunctionCallSchema>;

function functionCallsFromContext(filteredContext: unknown): FunctionCall[] {
  const layer2 = (
    filteredContext as { layer2_execution?: { function_calls?: FunctionCall[] } }
  ).layer2_execution;
  return layer2?.function_calls ?? [];
}

export function finalizeOutcomeAnalysis(
  result: OutcomeAnalysis,
  filteredContext: unknown,
  conversationMsgId?: string,
): OutcomeAnalysis {
  const withContradiction = applyContradictionFallback(
    result,
    filteredContext,
    conversationMsgId,
  );

  const classified = classifyResolutionPath(
    functionCallsFromContext(filteredContext),
  );

  const handoffReason =
    classified.handoff_reason === "failure_driven_escalation"
      ? "failure_driven_escalation"
      : withContradiction.handoff_reason ?? classified.handoff_reason;

  return {
    ...withContradiction,
    resolution_mode:
      withContradiction.resolution_mode ?? classified.resolution_mode,
    handoff_reason: handoffReason,
    handoff_detail_en:
      withContradiction.handoff_detail_en ?? classified.handoff_detail_en,
  };
}
