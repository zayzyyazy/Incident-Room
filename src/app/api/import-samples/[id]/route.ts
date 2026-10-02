import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const IMPORTS_DIR = path.join(process.cwd(), "fixtures", "imports");
const MANIFEST_PATH = path.join(IMPORTS_DIR, "manifest.json");

type RouteParams = { params: { id: string } };

function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as {
    samples: Array<{ id: string; file: string }>;
  };
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const manifest = readManifest();
    const sample = manifest.samples.find((s) => s.id === params.id);
    if (!sample) {
      return NextResponse.json({ ok: false, error: "Sample not found" }, { status: 404 });
    }

    const filePath = path.join(IMPORTS_DIR, sample.file);
    if (!filePath.startsWith(IMPORTS_DIR) || !fs.existsSync(filePath)) {
      return NextResponse.json({ ok: false, error: "Sample file missing" }, { status: 404 });
    }

    const rawJson = fs.readFileSync(filePath, "utf8");
    return NextResponse.json({
      ok: true,
      id: sample.id,
      rawJson,
      parsed: JSON.parse(rawJson),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load sample";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
