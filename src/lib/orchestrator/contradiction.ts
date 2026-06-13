import { OutcomeAnalysis } from "@/lib/band/message-types";
import {
  hasPrematureVerbalClosure,
  layer1FromContext,
} from "@/lib/orchestrator/verbal-closure";

type OutcomeContext = {
  conversation_analysis?: { conversation_verdict?: string };
};

export function applyContradictionFallback(
  result: OutcomeAnalysis,
  filteredContext: unknown,
  conversationMsgId?: string,
): OutcomeAnalysis {
  if (!conversationMsgId || result.contradicts_msg_id !== null) {
    return result;
  }

  if (result.execution_verdict !== "outcome_failed") {
    return result;
  }

  const conversationVerdict = (
    filteredContext as OutcomeContext
  ).conversation_analysis?.conversation_verdict;

  const layer1 = layer1FromContext(filteredContext);
  const prematureClosure = hasPrematureVerbalClosure(layer1);
  const resolvedButFailed = conversationVerdict === "appears_resolved";
  const softL1ButFailed =
    prematureClosure &&
    (conversationVerdict === "appears_unresolved" ||
      conversationVerdict === "ambiguous");

  if (!resolvedButFailed && !softL1ButFailed && !prematureClosure) {
    return result;
  }

  const turnRefs = layer1?.behavioral_hints
    ?.filter((hint) => hint.type === "premature_closure")
    .map((hint) => hint.turn_ref)
    .join(", ");

  const reason =
    result.contradiction_reason_en ??
    (resolvedButFailed
      ? "Conversation analysis reported resolution but execution layer shows the intended outcome did not occur."
      : turnRefs
        ? `Agent verbally confirmed completion (${turnRefs}) but execution layer shows the intended outcome did not occur.`
        : "Agent verbally implied completion but execution layer shows the intended outcome did not occur.");

  return {
    ...result,
    contradicts_msg_id: conversationMsgId,
    contradiction_reason_en: reason,
  };
}
