import { NextResponse } from "next/server";
import { getChatsCollection } from "@/lib/mongodb";
import { isMongoConfigured } from "@/lib/mongodb/config";
import { buildChatEvidence, StoredChatMessage } from "@/lib/chat/evidence";

type ChatHistoryDocument = StoredChatMessage & {
  userId?: string;
  evidence?: unknown;
  incident?: unknown;
  investigationInput?: unknown;
};

type RouteParams = { params: Promise<{ chatId: string }> };

const SINGLE_USER_ID = "user-123";

export async function GET(_request: Request, { params }: RouteParams) {
  if (!isMongoConfigured()) {
    return NextResponse.json(
      { error: "MongoDB is not configured. Set MONGODB_URI in .env.local" },
      { status: 503 },
    );
  }

  try {
    const { chatId } = await params;

    if (!chatId) {
      return NextResponse.json({ error: "chatId required" }, { status: 400 });
    }

    const collection = await getChatsCollection();

    const messages = await collection
      .find({ chatId, userId: SINGLE_USER_ID })
      .sort({ timestamp: 1 })
      .toArray();

    const typedMessages = messages as unknown as ChatHistoryDocument[];
    const storedMessages: StoredChatMessage[] = typedMessages.map((message) => ({
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      intent: message.intent,
      toolsCalled: message.toolsCalled ?? [],
      roomId: message.roomId,
      analyzer: message.analyzer,
      workflowTrace: message.workflowTrace,
    }));
    const latestRichMessage = [...typedMessages]
      .reverse()
      .find((message) => message.evidence || message.analyzer || message.incident);
    const userId = typedMessages.find((message) => message.userId)?.userId ?? SINGLE_USER_ID;
    const evidence =
      latestRichMessage?.evidence ??
      buildChatEvidence(storedMessages, {
        chatId,
        userId,
        roomId: latestRichMessage?.roomId,
        analyzer: latestRichMessage?.analyzer,
      });

    return NextResponse.json({
      chat_id: chatId,
      user_id: SINGLE_USER_ID,
      messages,
      evidence,
      investigation_input: { evidence },
      latest_analyzer: latestRichMessage?.analyzer ?? null,
      latest_incident: latestRichMessage?.incident ?? null,
    });
  } catch (error) {
    console.error("Error loading chat history:", error);
    return NextResponse.json({
      error: "Failed to load history",
    }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  if (!isMongoConfigured()) {
    return NextResponse.json(
      { error: "MongoDB is not configured. Set MONGODB_URI in .env.local" },
      { status: 503 },
    );
  }

  try {
    const { chatId } = await params;

    if (!chatId) {
      return NextResponse.json({ error: "chatId required" }, { status: 400 });
    }

    const collection = await getChatsCollection();

    const result = await collection.deleteMany({ chatId, userId: SINGLE_USER_ID });

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error deleting chat history:", error);
    return NextResponse.json({
      error: "Failed to delete history",
    }, { status: 500 });
  }
}
