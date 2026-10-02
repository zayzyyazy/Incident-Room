import { getChatsCollection } from "@/lib/mongodb";
import type { ChatListItem, MongoChatMessage } from "@/lib/chat/types";
import { detectChatFailureSignals } from "@/lib/chat/mongo-to-evidence";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toolCallFailed(tool: unknown): boolean {
  const record = asRecord(tool);
  if (!record) return false;
  if (record.error) return true;
  const result = record.result;
  if (typeof result === "string") {
    const lower = result.toLowerCase();
    if (
      lower.includes("error") ||
      lower.includes("failed") ||
      lower.includes("not found") ||
      lower.includes("unable to")
    ) {
      return true;
    }
  }
  const resultRecord = asRecord(result);
  if (resultRecord?.error || resultRecord?.success === false) return true;
  return false;
}

function messageLikelyFailure(message: MongoChatMessage): string[] {
  const signals: string[] = [];
  if (message.status === "failed" || message.status === "error") {
    signals.push("message_status_failed");
  }
  for (const tool of message.toolsCalled ?? []) {
    if (toolCallFailed(tool)) {
      signals.push(`tool_failed:${tool.name}`);
    }
  }
  const intent = String(message.intent ?? "").toLowerCase();
  if (intent.includes("fail") || intent.includes("error")) {
    signals.push("intent_failure");
  }
  return signals;
}

export async function listStoredChats(limit = 40): Promise<ChatListItem[]> {
  const collection = await getChatsCollection();

  const rows = await collection
    .aggregate([
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: "$chatId",
          chatId: { $first: "$chatId" },
          userId: { $first: "$userId" },
          messageCount: { $sum: 1 },
          lastTimestamp: { $max: "$timestamp" },
          lastContent: { $last: "$content" },
          lastRole: { $last: "$role" },
          intents: { $addToSet: "$intent" },
          messages: { $push: "$$ROOT" },
        },
      },
      { $sort: { lastTimestamp: -1 } },
      { $limit: limit },
    ])
    .toArray();

  return rows.map((row) => {
    const messages = (row.messages ?? []) as MongoChatMessage[];
    const failureSignals = new Set<string>();
    for (const message of messages) {
      for (const signal of messageLikelyFailure(message)) {
        failureSignals.add(signal);
      }
    }
    const chatFailure = detectChatFailureSignals(messages);
    for (const signal of chatFailure.signals) {
      failureSignals.add(signal);
    }

    const intents = (row.intents as (string | null)[]).filter(
      (value): value is string => Boolean(value),
    );

    return {
      chatId: String(row.chatId ?? row._id),
      userId: row.userId ? String(row.userId) : undefined,
      messageCount: Number(row.messageCount ?? 0),
      lastTimestamp: new Date(row.lastTimestamp as Date).toISOString(),
      preview: String(row.lastContent ?? "").slice(0, 120),
      lastRole: String(row.lastRole ?? "unknown"),
      intents,
      likelyFailure: failureSignals.size > 0,
      failureSignals: [...Array.from(failureSignals)],
    };
  });
}

export async function fetchChatMessages(chatId: string): Promise<MongoChatMessage[]> {
  const collection = await getChatsCollection();
  const messages = await collection.find({ chatId }).sort({ timestamp: 1 }).toArray();
  return messages.map((doc) => ({
    chatId: String(doc.chatId),
    userId: doc.userId ? String(doc.userId) : undefined,
    role: String(doc.role),
    content: String(doc.content ?? ""),
    intent: doc.intent ?? null,
    toolsCalled: Array.isArray(doc.toolsCalled) ? doc.toolsCalled : [],
    timestamp: doc.timestamp as Date,
    status: doc.status ? String(doc.status) : undefined,
    _id: doc._id?.toString(),
  }));
}
