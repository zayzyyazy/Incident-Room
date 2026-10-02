import { NextResponse } from "next/server";
import { DECK_HTML } from "./deck-content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Full-screen deck at /presentation (no app shell). */
export async function GET(request: Request) {
  let html = DECK_HTML;

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
