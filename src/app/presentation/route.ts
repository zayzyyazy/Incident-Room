import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Full-screen deck at /presentation (no app shell). */
export async function GET(request: Request) {
  const htmlPath = path.join(process.cwd(), "public/presentation/index.html");
  let html = fs.readFileSync(htmlPath, "utf8");

  const url = new URL(request.url);
  if (url.searchParams.get("print") === "1") {
    html = html.replace("<body>", '<body class="print-mode">');
  }

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}
