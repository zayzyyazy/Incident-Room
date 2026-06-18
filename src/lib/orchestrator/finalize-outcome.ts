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

function failureClassForCall(call: FunctionCall) {
  const result = call.result;
  const serialized = JSON.stringify(result ?? {}).toLowerCase();

  if (
    call.name === "placeOrder" ||
    serialized.includes('"sideeffectcreated":false') ||
    serialized.includes('"orderplaced":false')
  ) {
    return "noop_side_effect" as const;
  }

  if (call.status === "timeout") {
    return "backend_failure" as const;
  }

  return "silent_tool_error" as const;
}

function detailForCall(call: FunctionCall) {
  if (typeof call.error_message === "string") {
    return call.error_message;
  }

  return `Tool ${call.name} reported ${call.status ?? "error"} while handling the customer request.`;
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

  const functionCalls = functionCallsFromContext(filteredContext);
  const failedCalls = functionCalls.filter(
    (call) => call.status === "error" || call.status === "timeout",
  );
  const classified = classifyResolutionPath(functionCalls);
  const existingFailureTools = new Set(
    withContradiction.tool_failures.map((failure) => failure.tool_name),
  );
  const deterministicFailures = failedCalls
    .filter((call) => !existingFailureTools.has(call.name))
    .map((call) => ({
      tool_name: call.name,
      failure_class: failureClassForCall(call),
      detail_en: detailForCall(call),
      turn_ref: call.turn_ref,
    }));

  const handoffReason =
    classified.handoff_reason === "failure_driven_escalation"
      ? "failure_driven_escalation"
      : withContradiction.handoff_reason ?? classified.handoff_reason;

  return {
    ...withContradiction,
    execution_verdict:
      failedCalls.length > 0 ? "outcome_failed" : withContradiction.execution_verdict,
    summary_en:
      failedCalls.length > 0 &&
      withContradiction.execution_verdict !== "outcome_failed"
        ? `Execution failed because ${failedCalls.map((call) => call.name).join(", ")} did not complete the requested backend outcome.`
        : withContradiction.summary_en,
    tool_failures: [
      ...withContradiction.tool_failures,
      ...deterministicFailures,
    ],
    side_effects_observed: {
      ...withContradiction.side_effects_observed,
      failed_function_calls:
        failedCalls.length > 0
          ? failedCalls.map((call) => ({
              name: call.name,
              status: call.status,
              result: call.result,
            }))
          : withContradiction.side_effects_observed.failed_function_calls,
    },
    resolution_mode:
      withContradiction.resolution_mode ?? classified.resolution_mode,
    handoff_reason: handoffReason,
    handoff_detail_en:
      withContradiction.handoff_detail_en ?? classified.handoff_detail_en,
  };
}
