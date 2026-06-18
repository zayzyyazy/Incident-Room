import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const IMPORTS_DIR = path.join(process.cwd(), "fixtures", "imports");
const MANIFEST_PATH = path.join(IMPORTS_DIR, "manifest.json");

type Manifest = {
  samples: Array<{
    id: string;
    platform: string;
    title: string;
    file: string;
    hook: string;
  }>;
};

function readManifest(): Manifest {
  const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
  return JSON.parse(raw) as Manifest;
}

export async function GET() {
  try {
    const manifest = readManifest();
    return NextResponse.json({ ok: true, samples: manifest.samples });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load samples";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
