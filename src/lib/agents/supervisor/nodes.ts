import { ChatOpenAI } from "@langchain/openai";
export const SUPERVISOR_NODE = "supervisor";
// src/lib/agents/supervisor/nodes.ts
export async function supervisorNode(state: any) {
  // Get all messages except the last assistant response
  const conversationMessages = state.messages.filter((msg: any) => msg.role !== 'assistant' || !msg.content.includes('Intent detected'));
  
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
${conversationMessages.map((msg: any) => `${msg.role}: ${msg.content}`).join('\n')}

Classify the LATEST user message as one of:
- "order_status": Asking about order status, tracking, delivery
- "refund": Asking for refund, money back, return
- "product_info": Asking about product details, features
- "unknown": Anything else

Respond with ONLY the intent keyword.`;
  
  const response = await model.invoke([{ role: "user", content: prompt }]);
  const finalIntent = response.content.toString().toLowerCase().trim();
  
  console.log(`🎯 Intent: ${finalIntent} from conversation`);
  
  return {
    ...state,
    intent: finalIntent,
    messages: [...state.messages, { role: "assistant", content: `Intent detected: ${finalIntent}` }],
  };
}