import { NextResponse } from "next/server";
import { fetchChatMessages } from "@/lib/chat/mongo-queries";
import { mongoChatToImportPayload } from "@/lib/chat/mongo-to-evidence";
import { isMongoConfigured } from "@/lib/mongodb/config";

type RouteParams = { params: Promise<{ chatId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
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
    const { chatId } = await params;
    if (!chatId) {
      return NextResponse.json({ ok: false, error: "chatId required" }, { status: 400 });
    }

    const messages = await fetchChatMessages(chatId);
    if (!messages.length) {
      return NextResponse.json(
        { ok: false, error: `No messages found for chat ${chatId}` },
        { status: 404 },
      );
    }

    const exportPayload = mongoChatToImportPayload(messages, chatId);

    return NextResponse.json({
      ok: true,
      chatId,
      messageCount: messages.length,
      export: exportPayload,
      rawJson: JSON.stringify(exportPayload, null, 2),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export chat";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
