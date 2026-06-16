// app/api/chat-history/[chatId]/route.ts
import { NextResponse } from "next/server";
import getMongoClient from "@/lib/mongodb";
import { buildChatEvidence, StoredChatMessage } from "@/lib/chat/evidence";

type ChatHistoryDocument = StoredChatMessage & {
  userId?: string;
  evidence?: unknown;
  incident?: unknown;
  investigationInput?: unknown;
};

function chatDbName() {
  return process.env.MONGO_DB || "bands_hackathondb";
}

export async function GET(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const { chatId } = params;

    if (!chatId) {
      return NextResponse.json({ error: "chatId required" }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db(chatDbName());
    const collection = db.collection("chats");

    const messages = await collection
      .find({ chatId })
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
    const userId = typedMessages.find((message) => message.userId)?.userId ?? "customer_123";
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
      messages,
      evidence,
      investigation_input: { evidence },
      latest_analyzer: latestRichMessage?.analyzer ?? null,
      latest_incident: latestRichMessage?.incident ?? null,
    });
    
  } catch (error) {
    console.error("Error loading chat history:", error);
    return NextResponse.json({ 
      error: "Failed to load history" 
    }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const { chatId } = params;

    if (!chatId) {
      return NextResponse.json({ error: "chatId required" }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db(chatDbName());
    const collection = db.collection("chats");

    const result = await collection.deleteMany({ chatId });

    return NextResponse.json({ 
      success: true, 
      deletedCount: result.deletedCount 
    });
    
  } catch (error) {
    console.error("Error deleting chat history:", error);
    return NextResponse.json({ 
      error: "Failed to delete history" 
    }, { status: 500 });
  }
}