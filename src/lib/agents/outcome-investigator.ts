import {
  OutcomeAnalysisSchema,
  OutcomeAnalysis,
} from "@/lib/band/message-types";
import { OUTCOME_INVESTIGATOR_SYSTEM_PROMPT } from "@/lib/agents/prompts/outcome-investigator";
import { AGENT_MODELS, completeJson } from "@/lib/llm/router";
import { finalizeOutcomeAnalysis } from "@/lib/orchestrator/finalize-outcome";

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

    return finalizeOutcomeAnalysis(result, filteredContext, conversationMsgId);
  } catch (primaryError) {
    const fallback = primary.fallback;
    try {
      const result = await completeJson(OutcomeAnalysisSchema, {
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
      return finalizeOutcomeAnalysis(result, filteredContext, conversationMsgId);
    } catch {
      throw primaryError;
    }
  }
}
