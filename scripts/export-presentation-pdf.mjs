#!/usr/bin/env node
/**
 * Export deck PDF via local dev server (print-optimized layout).
 * 1. Starts nothing — run `npm run dev` first OR script uses file URL fallback message
 * Usage: npm run presentation:pdf
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "docs/presentation/Incident-Room-Deck.pdf");

const base = process.env.PRESENTATION_URL ?? "http://localhost:3000/presentation?print=1";
const url = base.includes("print=1") ? base : `${base}${base.includes("?") ? "&" : "?"}print=1`;

let browser;
try {
  browser = await chromium.launch({ headless: true, channel: "chrome" });
} catch {
  console.error(
    "Could not launch Chrome. Open this URL and Cmd+P → Save as PDF:\n  " + url,
  );
  process.exit(1);
}

const page = await browser.newPage();
try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
} catch {
  console.error(
    "Dev server not running. Start it with `npm run dev`, then re-run.\nOr open in Chrome:\n  " +
      url +
      "\nCmd+P → Landscape → Background graphics ON",
  );
  await browser.close();
  process.exit(1);
}

await page.emulateMedia({ media: "print" });
await page.pdf({
  path: outPath,
  landscape: true,
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});
await browser.close();
console.log(`PDF written: ${outPath}`);
