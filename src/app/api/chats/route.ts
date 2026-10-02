import { NextResponse } from "next/server";
import { listStoredChats } from "@/lib/chat/mongo-queries";
import { isMongoConfigured } from "@/lib/mongodb/config";

export async function GET(request: Request) {
  if (!isMongoConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "MongoDB is not configured. Set MONGODB_URI and MONGO_DB in .env.local",
      },
      { status: 503 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 40), 100);
    const failuresOnly = searchParams.get("failuresOnly") === "1";

    let chats = await listStoredChats(limit);
    if (failuresOnly) {
      chats = chats.filter((chat) => chat.likelyFailure);
    }

    return NextResponse.json({ ok: true, chats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list chats";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
