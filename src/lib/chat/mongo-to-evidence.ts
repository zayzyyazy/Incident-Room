import type { MongoChatMessage } from "@/lib/chat/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeRole(role: string): "user" | "assistant" | "system" {
  const value = role.toLowerCase();
  if (value === "user" || value === "customer" || value === "human") return "user";
  if (value === "system") return "system";
  return "assistant";
}

function toolLooksFailed(tool: { name: string; result?: unknown; error?: unknown }): boolean {
  if (tool.error) return true;
  const result = tool.result;
  if (typeof result === "string") {
    const lower = result.toLowerCase();
    return (
      lower.includes("error") ||
      lower.includes("failed") ||
      lower.includes("not found") ||
      lower.includes("unable to")
    );
  }
  const record = asRecord(result);
  return Boolean(record?.error || record?.success === false);
}

export function detectChatFailureSignals(messages: MongoChatMessage[]): {
  likelyFailure: boolean;
  signals: string[];
} {
  const signals = new Set<string>();

  for (const message of messages) {
    if (message.status === "failed" || message.status === "error") {
      signals.add("message_status_failed");
    }
    for (const tool of message.toolsCalled ?? []) {
      if (toolLooksFailed(tool)) {
        signals.add(`tool_failed:${tool.name}`);
      }
    }
    const intent = String(message.intent ?? "").toLowerCase();
    if (intent.includes("fail") || intent.includes("error")) {
      signals.add("intent_failure");
    }
  }

  const assistantClaims = messages
    .filter((m) => normalizeRole(m.role) === "assistant")
    .map((m) => m.content.toLowerCase());
  const userConcerns = messages
    .filter((m) => normalizeRole(m.role) === "user")
    .map((m) => m.content.toLowerCase());

  const successPhrases = [
    "booked",
    "scheduled",
    "confirmed",
    "callback",
    "cancelled",
    "canceled",
    "paused",
    "done",
    "completed",
  ];
  const hasSuccessClaim = assistantClaims.some((text) =>
    successPhrases.some((phrase) => text.includes(phrase)),
  );
  const hasToolFailure = Array.from(signals).some((s) => s.startsWith("tool_failed:"));
  if (hasSuccessClaim && hasToolFailure) {
    signals.add("promise_without_execution");
  }

  if (
    userConcerns.some(
      (text) =>
        text.includes("didn't") ||
        text.includes("not working") ||
        text.includes("still waiting") ||
        text.includes("never"),
    )
  ) {
    signals.add("customer_pushback");
  }

  return { likelyFailure: signals.size > 0, signals: Array.from(signals) };
}

function deriveTitle(messages: MongoChatMessage[]): string {
  const firstUser = messages.find((m) => normalizeRole(m.role) === "user");
  if (firstUser?.content.trim()) {
    const snippet = firstUser.content.trim().slice(0, 72);
    return `Agent chat — ${snippet}${firstUser.content.length > 72 ? "…" : ""}`;
  }
  return `Agent chat ${messages[0]?.chatId?.slice(0, 8) ?? "export"}`;
}

export function mongoChatToImportPayload(
  messages: MongoChatMessage[],
  chatId: string,
): Record<string, unknown> {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const openAiMessages = sorted.map((message) => {
    const role = normalizeRole(message.role);
    const entry: Record<string, unknown> = {
      role,
      content: message.content,
    };
    if (message.toolsCalled?.length) {
      entry.tool_calls = message.toolsCalled.map((tool) => ({
        name: tool.name,
        arguments: tool.arguments ?? {},
        result: tool.result,
      }));
    }
    if (message.intent) {
      entry.intent = message.intent;
    }
    return entry;
  });

  const failure = detectChatFailureSignals(sorted);
  const lastTimestamp = sorted.at(-1)?.timestamp;

  return {
    chat_id: chatId,
    source_platform: "synthetic",
    title: deriveTitle(sorted),
    status: failure.likelyFailure ? "failed" : "completed",
    messages: openAiMessages,
    call_metadata: {
      status: failure.likelyFailure ? "failed" : "completed",
      agent_id: "bands_hackathon_chat",
      duration_sec: 0,
    },
    _mongo_chat_export: {
      chat_id: chatId,
      message_count: sorted.length,
      exported_at: new Date().toISOString(),
      last_message_at: lastTimestamp
        ? new Date(lastTimestamp).toISOString()
        : undefined,
      failure_signals: failure.signals,
      likely_failure: failure.likelyFailure,
      raw_messages: sorted,
    },
  };
}

export function mongoChatToImportJson(messages: MongoChatMessage[], chatId: string): string {
  return JSON.stringify(mongoChatToImportPayload(messages, chatId), null, 2);
}
