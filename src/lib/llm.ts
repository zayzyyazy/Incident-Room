import { ChatOpenAI } from "@langchain/openai";

export const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",        // or "gpt-4o" for better reasoning
  temperature: 0.3,
   configuration: {
    baseURL: "https://api.aimlapi.com/v1",  // AI/ML API endpoint
  },
  apiKey: process.env.AIMLAPI_KEY,   // or AI/ML proxy key
});