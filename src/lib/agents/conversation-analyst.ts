import {
  ConversationAnalysisSchema,
  ConversationAnalysis,
} from "@/lib/band/message-types";
import { CONVERSATION_ANALYST_SYSTEM_PROMPT } from "@/lib/agents/prompts/conversation-analyst";
import { AGENT_MODELS, completeJson } from "@/lib/llm/router";

export async function runConversationAnalyst(
  filteredContext: unknown,
): Promise<ConversationAnalysis> {
  const primary = AGENT_MODELS.conversationAnalyst;

  try {
    return await completeJson(ConversationAnalysisSchema, {
      provider: primary.provider,
      model: primary.model,
      messages: [
        { role: "system", content: CONVERSATION_ANALYST_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify(filteredContext, null, 2),
        },
      ],
    });
  } catch (primaryError) {
    const fallback = primary.fallback;
    try {
      return await completeJson(ConversationAnalysisSchema, {
        provider: fallback.provider,
        model: fallback.model,
        messages: [
          { role: "system", content: CONVERSATION_ANALYST_SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify(filteredContext, null, 2),
          },
        ],
      });
    } catch {
      throw primaryError;
    }
  }
}
