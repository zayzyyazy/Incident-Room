// app/api/store-history/route.ts
import { NextResponse } from "next/server";
import getMongoClient from "@/lib/mongodb";

const SINGLE_USER_ID = "user-123";

function chatDbName() {
  return process.env.MONGO_DB || "bands_hackathondb";
}

export async function POST(request: Request) {
  try {
    const {
      chatId,
      role,
      content,
      intent,
      toolsCalled,
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

    const client = await getMongoClient();
    const db = client.db(chatDbName());
    const collection = db.collection("chats");

    await collection.insertOne({
      chatId,
      userId: SINGLE_USER_ID,
      role,
      content,
      intent: intent || null,
      toolsCalled: toolsCalled || [],
      roomId: roomId || null,
      workflowTrace: workflowTrace || [],
      analyzer: analyzer || null,
      evidence: evidence || null,
      investigationInput: investigationInput || null,
      incident: incident || null,
      timestamp: new Date()
    });

    return NextResponse.json({ success: true, userId: SINGLE_USER_ID });
  } catch (error) {
    console.error("Failed to store chat history:", error);
    return NextResponse.json({ error: "Failed to store message" }, { status: 500 });
  }
}