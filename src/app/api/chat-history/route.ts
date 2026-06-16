import { NextResponse } from "next/server";
import getMongoClient from "@/lib/mongodb";

export const dynamic = "force-dynamic";

type ChatDocument = {
  chatId?: string;
  userId?: string;
  role?: string;
  content?: string;
  timestamp?: Date | string;
  intent?: string | null;
  roomId?: string | null;
  incident?: unknown;
  analyzer?: unknown;
};

function chatDbName() {
  return process.env.MONGO_DB || "bands_hackathondb";
}

function titleFromMessage(message?: ChatDocument) {
  const content = message?.content?.trim();
  if (!content) {
    return "Untitled chat";
  }

  return content.length > 52 ? `${content.slice(0, 49)}...` : content;
}

export async function GET() {
  try {
    const client = await getMongoClient();
    const db = client.db(chatDbName());
    const collection = db.collection("chats");

    const messages = (await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(500)
      .toArray()) as unknown as ChatDocument[];

    const grouped = new Map<
      string,
      {
        chatId: string;
        title: string;
        preview: string;
        userId?: string;
        messageCount: number;
        updatedAt: string;
        intent?: string | null;
        roomId?: string | null;
        hasIncident: boolean;
      }
    >();

    for (const message of messages) {
      if (!message.chatId) {
        continue;
      }

      const timestamp = message.timestamp
        ? new Date(message.timestamp).toISOString()
        : new Date().toISOString();
      const existing = grouped.get(message.chatId);

      if (existing) {
        existing.messageCount += 1;
        if (!existing.intent && message.intent) {
          existing.intent = message.intent;
        }
        if (!existing.roomId && message.roomId) {
          existing.roomId = message.roomId;
        }
        existing.hasIncident = existing.hasIncident || Boolean(message.incident);
        if (!existing.userId && message.userId) {
          existing.userId = message.userId;
        }
        if (message.role === "user") {
          existing.title = titleFromMessage(message);
        }
        continue;
      }

      grouped.set(message.chatId, {
        chatId: message.chatId,
        title: message.role === "user" ? titleFromMessage(message) : message.chatId,
        preview: message.content?.trim().slice(0, 80) || "No messages yet",
        userId: message.userId,
        messageCount: 1,
        updatedAt: timestamp,
        intent: message.intent,
        roomId: message.roomId,
        hasIncident: Boolean(message.incident),
      });
    }

    return NextResponse.json({
      ok: true,
      chats: Array.from(grouped.values()).sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    });
  } catch (error) {
    console.error("Error listing chat history:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to list chat history" },
      { status: 500 },
    );
  }
}
