import {
  OutcomeAnalysisSchema,
  OutcomeAnalysis,
} from "@/lib/band/message-types";
import { OUTCOME_INVESTIGATOR_SYSTEM_PROMPT } from "@/lib/agents/prompts/outcome-investigator";
import { AGENT_MODELS, completeJson } from "@/lib/llm/router";

export async function runOutcomeInvestigator(
  filteredContext: unknown,
  conversationMsgId?: string,
): Promise<OutcomeAnalysis> {
  const contextWithMsgId = {
    ...(filteredContext as Record<string, unknown>),
    conversation_analysis_msg_id: conversationMsgId ?? null,
  };

  const primary = AGENT_MODELS.outcomeInvestigator;

  try {
    const result = await completeJson(OutcomeAnalysisSchema, {
      provider: primary.provider,
      model: primary.model,
      messages: [
        { role: "system", content: OUTCOME_INVESTIGATOR_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify(contextWithMsgId, null, 2),
        },
      ],
    });

    if (
      conversationMsgId &&
      result.contradicts_msg_id === null &&
      result.execution_verdict === "outcome_failed" &&
      (filteredContext as { conversation_analysis?: { conversation_verdict?: string } })
        .conversation_analysis?.conversation_verdict === "appears_resolved"
    ) {
      return {
        ...result,
        contradicts_msg_id: conversationMsgId,
        contradiction_reason_en:
          result.contradiction_reason_en ??
          "Conversation analysis reported resolution but execution layer shows the intended outcome did not occur.",
      };
    }

    return result;
  } catch (primaryError) {
    const fallback = primary.fallback;
    try {
      return await completeJson(OutcomeAnalysisSchema, {
        provider: fallback.provider,
        model: fallback.model,
        messages: [
          { role: "system", content: OUTCOME_INVESTIGATOR_SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify(contextWithMsgId, null, 2),
          },
        ],
      });
    } catch {
      throw primaryError;
    }
  }
}
