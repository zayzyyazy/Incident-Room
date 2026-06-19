#!/usr/bin/env node
/**
 * Export Incident Room HTML deck to PDF (all slides, landscape).
 * Usage: npm run presentation:pdf
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const htmlPath = path.join(root, "docs/presentation/index.html");
const outPath = path.join(root, "docs/presentation/Incident-Room-Deck.pdf");

const fileUrl = `file://${htmlPath}`;

const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
});
const page = await browser.newPage();
await page.goto(fileUrl, { waitUntil: "networkidle" });
await page.pdf({
  path: outPath,
  landscape: true,
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});
await browser.close();

console.log(`PDF written: ${outPath}`);
