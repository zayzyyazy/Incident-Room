import { NextResponse } from "next/server";
import { getChatsCollection } from "@/lib/mongodb";
import { isMongoConfigured } from "@/lib/mongodb/config";

const SINGLE_USER_ID = "user-123";

export async function POST(request: Request) {
  if (!isMongoConfigured()) {
    return NextResponse.json(
      { error: "MongoDB is not configured. Set MONGODB_URI in .env.local" },
      { status: 503 },
    );
  }

  try {
    const {
      chatId,
      userId,
      role,
      content,
      intent,
      toolsCalled,
      status,
      roomId,
      workflowTrace,
      analyzer,
      evidence,
      investigationInput,
      incident,
    } = await request.json();

    if (!chatId || !role || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const collection = await getChatsCollection();

    await collection.insertOne({
      chatId,
      userId: userId ?? SINGLE_USER_ID,
      role,
      content,
      intent: intent || null,
      toolsCalled: toolsCalled || [],
      status: status ?? null,
      roomId: roomId || null,
      workflowTrace: workflowTrace || [],
      analyzer: analyzer || null,
      evidence: evidence || null,
      investigationInput: investigationInput || null,
      incident: incident || null,
      timestamp: new Date(),
    });

    return NextResponse.json({ success: true, userId: userId ?? SINGLE_USER_ID });
  } catch (error) {
    console.error("Failed to store chat history:", error);
    const message = error instanceof Error ? error.message : "Failed to store message";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
