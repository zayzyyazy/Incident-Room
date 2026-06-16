import { ChatOpenAI } from "@langchain/openai";
import { postBandWorkflowEvent } from "@/lib/band/agent-workflow";
export const SUPERVISOR_NODE = "supervisor";
// src/lib/agents/supervisor/nodes.ts

type AgentMessage = {
  role: string;
  content: string;
};

type SupervisorState = {
  messages: AgentMessage[];
  roomId: string;
  userId: string;
  intent: string;
};

function classifyIntentFromText(text: string) {
  const lowered = text.toLowerCase();
  if (/\b(thanks|thank you|bye|goodbye|that's all|that is all|resolved|done)\b/.test(lowered)) {
    return "end_chat";
  }
  if (/\b(human|person|agent|representative|manager|escalate|call me)\b/.test(lowered)) {
    return "human_handoff";
  }
  if (/\b(refund|money back|return|chargeback|cancel order)\b/.test(lowered)) {
    return "refund";
  }
  if (/\b(status|tracking|track|delivery|delivered|where is|eta|shipped)\b/.test(lowered)) {
    return "order_status";
  }
  if (/\b(product|feature|size|color|spec|details)\b/.test(lowered)) {
    return "product_info";
  }
  return "unknown";
}

async function writeIntentToBand(
  state: SupervisorState,
  intent: string,
  latestUserMessage: string,
) {
  try {
    await postBandWorkflowEvent(
      "supervisor",
      state.roomId,
      "intent_analysis",
      {
        intent,
        userId: state.userId,
        latest_message: latestUserMessage,
        transcript_turns: state.messages.length,
      },
      {
        mentionRole: "doer",
        metadata: { intent },
      },
    );
  } catch (error) {
    console.warn("Band supervisor intent handoff failed", error);
  }
}

export async function supervisorNode(state: SupervisorState) {
  // Get all messages except the last assistant response
  const conversationMessages = state.messages.filter((msg) => msg.role !== 'assistant' || !msg.content.includes('Intent detected'));
  const latestUserMessage = [...conversationMessages]
    .reverse()
    .find((msg) => msg.role === "user")?.content ?? "";

  if (!process.env.AIMLAPI_KEY && !process.env.BAND_API_KEY) {
    const fallbackIntent = classifyIntentFromText(latestUserMessage);
    console.log(`🎯 Intent fallback: ${fallbackIntent} from conversation`);
    await writeIntentToBand(state, fallbackIntent, latestUserMessage);

    return {
      ...state,
      intent: fallbackIntent,
      messages: [...state.messages, { role: "assistant", content: `Intent detected: ${fallbackIntent}` }],
    };
  }
  
  const model = new ChatOpenAI({
    apiKey: process.env.AIMLAPI_KEY || process.env.BAND_API_KEY,
    configuration: {
      baseURL: "https://api.aimlapi.com/v1",
    },
    modelName: "gpt-4o-mini",
    temperature: 0,
  });
  
  const prompt = `Analyze the user's intent from the conversation below.
  
Conversation history:
${conversationMessages.map((msg) => `${msg.role}: ${msg.content}`).join('\n')}

Classify the LATEST user message as one of:
- "order_status": Asking about order status, tracking, delivery
- "refund": Asking for refund, money back, return, cancellation
- "human_handoff": Asking for a person, manager, escalation, or call back
- "end_chat": The customer says thanks, bye, done, resolved, or otherwise ends the chat
- "product_info": Asking about product details, features
- "unknown": Anything else

Respond with ONLY the intent keyword.`;
  
  const response = await model.invoke([{ role: "user", content: prompt }]);
  const rawIntent = response.content.toString().toLowerCase().trim();
  const validIntents = new Set([
    "order_status",
    "refund",
    "human_handoff",
    "end_chat",
    "product_info",
    "unknown",
  ]);
  const finalIntent = validIntents.has(rawIntent)
    ? rawIntent
    : classifyIntentFromText(latestUserMessage);
  
  console.log(`🎯 Intent: ${finalIntent} from conversation`);
  await writeIntentToBand(state, finalIntent, latestUserMessage);
  
  return {
    ...state,
    intent: finalIntent,
    messages: [...state.messages, { role: "assistant", content: `Intent detected: ${finalIntent}` }],
  };
}