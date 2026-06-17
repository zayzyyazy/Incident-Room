import { NextResponse } from "next/server";
import { normalizeImportedJson } from "@/lib/normalizer/import-evidence";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { rawJson?: string };
    if (!body.rawJson || body.rawJson.trim().length < 2) {
      return NextResponse.json(
        { ok: false, error: "rawJson is required" },
        { status: 400 },
      );
    }

    const { evidence, report } = normalizeImportedJson(body.rawJson);

    return NextResponse.json({
      ok: true,
      evidence,
      report,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Normalize failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
