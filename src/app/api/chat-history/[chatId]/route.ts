// app/api/chat-history/[chatId]/route.ts
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

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

    return NextResponse.json({ 
      chat_id: chatId, 
      messages: messages 
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
    const db = client.db("chatdb");
    const collection = db.collection("messages");

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