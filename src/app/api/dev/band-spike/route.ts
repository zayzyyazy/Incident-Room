import { NextResponse } from "next/server";
import {
  createRoom,
  formatBandPost,
  getRoomHistory,
  postMessage,
} from "@/lib/band/client";

export async function POST() {
  try {
    const room = await createRoom();

    const first = await postMessage(
      room.id,
      formatBandPost("System", "spike", {
        step: 1,
        message: "Incident Room Band spike — room created.",
      }),
      { type: "spike", step: 1 },
    );

    const second = await postMessage(
      room.id,
      formatBandPost("System", "spike", {
        step: 2,
        message: "Second post — check Band dashboard for this room.",
        roomId: room.id,
      }),
      { type: "spike", step: 2 },
    );

    const history = await getRoomHistory(room.id);

    return NextResponse.json({
      ok: true,
      roomId: room.id,
      posts: [first, second],
      historyCount: history.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
