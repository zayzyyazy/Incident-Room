// app/api/chat-history/[chatId]/route.ts
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { buildChatEvidence, StoredChatMessage } from "@/lib/chat/evidence";

export async function GET(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const { chatId } = params;

    if (!chatId) {
      return NextResponse.json({ error: "chatId required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("bands_hackathondb");
    const collection = db.collection("chats");

    const messages = await collection
      .find({ chatId })
      .sort({ timestamp: 1 })
      .toArray();

    const storedMessages: StoredChatMessage[] = messages.map((message: any) => ({
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      intent: message.intent,
      toolsCalled: message.toolsCalled ?? [],
      roomId: message.roomId,
      analyzer: message.analyzer,
      workflowTrace: message.workflowTrace,
    }));
    const latestRichMessage = [...messages]
      .reverse()
      .find((message: any) => message.evidence || message.analyzer || message.incident);
    const userId = messages.find((message: any) => message.userId)?.userId ?? "customer_123";
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

    const client = await clientPromise;
    const db = client.db("bands_hackathondb");
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