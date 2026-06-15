import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { arch } from "node:os";

if (arch() === "arm64" && !process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE) {
  process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE = "mac-arm64";
}
const localBrowsers = path.join(process.cwd(), ".playwright-browsers");
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(localBrowsers)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowsers;
}

const OUT = path.join(process.cwd(), "docs/screenshots");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const shots = [
  { file: "01-dashboard.png", url: `${BASE}/`, waitMs: 2000 },
  {
    file: "02-incident-room.png",
    url: `${BASE}/incidents/SYN-2026-0615-priya`,
    waitMs: 2500,
  },
  {
    file: "03-investigation-live.png",
    url: `${BASE}/incidents/SYN-2026-0615-priya`,
    waitMs: 1500,
    action: async (page) => {
      const btn = page.getByRole("button", { name: /Run investigation/i });
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(6000);
      }
    },
  },
  { file: "04-guide.png", url: `${BASE}/guide`, waitMs: 1500 },
  {
    file: "05-klaus-incident.png",
    url: `${BASE}/incidents/PMB-2024-0847`,
    waitMs: 2500,
  },
];

fs.mkdirSync(OUT, { recursive: true });

async function launchBrowser() {
  const base = { headless: true };
  try {
    return await chromium.launch({ ...base, channel: "chrome" });
  } catch (err) {
    console.warn("Chrome channel not found, using bundled Chromium:", err.message);
    return await chromium.launch({
      ...base,
      executablePath: chromium.executablePath(),
    });
  }
}

const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

for (const shot of shots) {
  console.log(`Capturing ${shot.url} -> ${shot.file}`);
  await page.goto(shot.url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(shot.waitMs);
  if (shot.action) await shot.action(page);
  await page.screenshot({
    path: path.join(OUT, shot.file),
    fullPage: true,
  });
}

await browser.close();
console.log("Done:", fs.readdirSync(OUT).join(", "));
