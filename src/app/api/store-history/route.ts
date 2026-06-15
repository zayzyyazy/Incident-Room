// app/api/store-history/route.ts
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function POST(request: Request) {
  try {
    const { chatId, userId, role, content, intent, toolsCalled } = await request.json();

    if (!chatId || !userId || !role || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("bands_hackathondb");
    const collection = db.collection("chats");

    await collection.insertOne({
      chatId,
      userId,
      role,
      content,
      intent: intent || null,
      toolsCalled: toolsCalled || [],
      timestamp: new Date()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to store message" }, { status: 500 });
  }
}