import { z } from "zod";

/** Causal hypothesis classes — not observations. */
export const CausalHypothesisClassSchema = z.enum([
  "ungrounded_success_claim",
  "tool_not_called",
  "partial_workflow_execution",
  "confirmation_before_execution",
  "confirmation_claim_requires_execution_outcome",
  "missing_side_effect",
  "stale_state_assumption",
  "backend_failure_only",
  "failed_execution_must_be_part_of_cause",
  "false_completion_signal_after_missing_execution",
  "premature_confirmation_after_api_failure",
  "premature_confirmation_after_failed_execution",
  "silent_failure_after_tool_invocation",
  "partial_workflow_completion",
  "failure_driven_handoff_disguised_as_success",
  "customer_misunderstanding_only",
  "confirmation_without_execution_proof",
  "confirmation_without_tool_execution",
]);

export type CausalHypothesisClass = z.infer<typeof CausalHypothesisClassSchema>;

export const HypothesisStatusSchema = z.enum([
  "accepted",
  "rejected",
  "refined",
  "pending",
]);

export type HypothesisStatus = z.infer<typeof HypothesisStatusSchema>;

export const OPENING_HYPOTHESIS_CLASSES = {
  claimTracer: [
    "ungrounded_success_claim",
    "customer_misunderstanding_only",
    "confirmation_before_execution",
  ] as const,
  backendWitness: [
    "tool_not_called",
    "backend_failure_only",
    "partial_workflow_execution",
    "missing_side_effect",
  ] as const,
} as const;

export const CONVERSATION_DOMAIN_CLASSES = new Set<CausalHypothesisClass>([
  "ungrounded_success_claim",
  "confirmation_before_execution",
  "confirmation_claim_requires_execution_outcome",
  "customer_misunderstanding_only",
]);

/** Classes only Backend Witness may assert — Claim Tracer must never adopt these. */
export const EXECUTION_DOMAIN_CLASSES = new Set<CausalHypothesisClass>([
  "tool_not_called",
  "backend_failure_only",
  "partial_workflow_execution",
  "missing_side_effect",
  "stale_state_assumption",
  "failed_execution_must_be_part_of_cause",
]);

/** Bridge-only classes Causal Judge introduces — neither opening agent should land here alone. */
export const BRIDGE_HYPOTHESIS_CLASSES = new Set<CausalHypothesisClass>([
  "false_completion_signal_after_missing_execution",
  "premature_confirmation_after_api_failure",
  "premature_confirmation_after_failed_execution",
  "silent_failure_after_tool_invocation",
  "partial_workflow_completion",
  "failure_driven_handoff_disguised_as_success",
]);

export function pickBridgeClassForOpenings(
  claimTracerOpening: CausalHypothesisClass,
  backendWitnessOpening: CausalHypothesisClass,
): CausalHypothesisClass {
  if (
    backendWitnessOpening === "backend_failure_only" ||
    backendWitnessOpening === "partial_workflow_execution" ||
    backendWitnessOpening === "failed_execution_must_be_part_of_cause"
  ) {
    if (
      claimTracerOpening === "confirmation_before_execution" ||
      claimTracerOpening === "ungrounded_success_claim" ||
      claimTracerOpening === "confirmation_claim_requires_execution_outcome"
    ) {
      return "premature_confirmation_after_failed_execution";
    }
  }
  if (backendWitnessOpening === "tool_not_called") {
    return "false_completion_signal_after_missing_execution";
  }
  return "premature_confirmation_after_failed_execution";
}

export function hypothesisClassLabel(value: string): string {
  return value.replace(/_/g, " ");
}
