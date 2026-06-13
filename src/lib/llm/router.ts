import { z } from "zod";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type Provider = "aimlapi" | "featherless";

type CompletionOptions = {
  provider: Provider;
  model: string;
  messages: LlmMessage[];
  temperature?: number;
};

const AIML_BASE = "https://api.aimlapi.com/v1";
const FEATHERLESS_BASE = "https://api.featherless.ai/v1";

async function openAiCompatibleCompletion(
  baseUrl: string,
  apiKey: string,
  options: CompletionOptions,
): Promise<string> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.2,
      response_format: { type: "json_object" },
    }),
  });

  const text = await response.text();
  const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    throw new Error(
      `LLM request failed (${response.status}): ${JSON.stringify(body)}`,
    );
  }

  const content = (
    body.choices as Array<{ message?: { content?: string } }> | undefined
  )?.[0]?.message?.content;

  if (!content) {
    throw new Error("LLM returned empty content");
  }

  return content;
}

export async function completeJson<T extends z.ZodType>(
  schema: T,
  options: CompletionOptions,
): Promise<z.infer<T>> {
  const providerKey =
    options.provider === "aimlapi"
      ? process.env.AIMLAPI_KEY
      : process.env.FEATHERLESS_API_KEY;

  if (!providerKey) {
    throw new Error(
      `${options.provider === "aimlapi" ? "AIMLAPI_KEY" : "FEATHERLESS_API_KEY"} is not set`,
    );
  }

  const baseUrl =
    options.provider === "aimlapi" ? AIML_BASE : FEATHERLESS_BASE;

  const raw = await openAiCompatibleCompletion(baseUrl, providerKey, options);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`LLM did not return JSON: ${raw.slice(0, 400)}`);
    }
    parsed = JSON.parse(match[0]);
  }

  return schema.parse(parsed);
}

export const AGENT_MODELS = {
  conversationAnalyst: {
    provider: "aimlapi" as const,
    model: "gpt-4o-mini",
    fallback: { provider: "featherless" as const, model: "Qwen/Qwen3-8B" },
  },
  outcomeInvestigator: {
    provider: "featherless" as const,
    model: "deepseek-ai/DeepSeek-V3",
    fallback: { provider: "aimlapi" as const, model: "gpt-4o" },
  },
};
