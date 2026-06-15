import {
  ConversationAnalysisSchema,
  ConversationAnalysis,
} from "@/lib/band/message-types";
import { CONVERSATION_ANALYST_SYSTEM_PROMPT } from "@/lib/agents/prompts/conversation-analyst";
import { AGENT_MODELS, completeJson } from "@/lib/llm/router";
import {
  getPrematureClosureTurnRefs,
  layer1FromContext,
} from "@/lib/orchestrator/verbal-closure";

function applyConversationVerdictFallback(
  result: ConversationAnalysis,
  filteredContext: unknown,
): ConversationAnalysis {
  if (result.conversation_verdict === "appears_resolved") {
    return result;
  }

  const layer1 = layer1FromContext(filteredContext);
  const closureTurns = getPrematureClosureTurnRefs(layer1);
  if (closureTurns.length === 0) {
    return result;
  }

  const notableTurns = Array.from(
    new Set([...(result.notable_turns ?? []), ...closureTurns]),
  );

  return {
    ...result,
    conversation_verdict: "appears_resolved",
    notable_turns: notableTurns,
    customer_perception:
      result.customer_perception.includes("believes") ||
      result.customer_perception.includes("updated") ||
      result.customer_perception.includes("scheduled")
        ? result.customer_perception
        : `The customer likely believes the request was completed based on the agent's confirmation at ${closureTurns.join(", ")}.`,
  };
}

export async function runConversationAnalyst(
  filteredContext: unknown,
): Promise<ConversationAnalysis> {
  const primary = AGENT_MODELS.conversationAnalyst;

  try {
    const result = await completeJson(ConversationAnalysisSchema, {
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
    return applyConversationVerdictFallback(result, filteredContext);
  } catch (primaryError) {
    const fallback = primary.fallback;
    try {
      const result = await completeJson(ConversationAnalysisSchema, {
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
      return applyConversationVerdictFallback(result, filteredContext);
    } catch {
      throw primaryError;
    }
  }
}
