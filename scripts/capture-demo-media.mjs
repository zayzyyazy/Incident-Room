/**
 * Captures README screenshots + demo walkthrough video for retell_call_clinic_44102.
 * Prereq: npm run dev (localhost:3000)
 */
import fs from "node:fs";
import path from "node:path";

const localBrowsers = path.join(process.cwd(), ".playwright-browsers");
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(localBrowsers)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowsers;
}

const { chromium } = await import("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const INCIDENT = "retell_call_clinic_44102";
const OUT = path.join(process.cwd(), "docs/screenshots");
const VIDEO_DIR = path.join(OUT, "demo-video-tmp");

fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(VIDEO_DIR, { recursive: true, force: true });
fs.mkdirSync(VIDEO_DIR, { recursive: true });

function resolveChromiumExecutable() {
  const pb = process.env.PLAYWRIGHT_BROWSERS_PATH ?? localBrowsers;
  const roots = ["chrome-mac-arm64", "chrome-mac-x64"];
  for (const root of roots) {
    const exe = path.join(
      pb,
      "chromium-1228",
      root,
      "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    );
    if (fs.existsSync(exe)) return exe;
  }
  return chromium.executablePath();
}

async function launchBrowser() {
  const base = { headless: true, timeout: 60_000 };
  return chromium.launch({
    ...base,
    executablePath: resolveChromiumExecutable(),
  });
}

async function clipMain(page, file) {
  const main = page.locator("main").first();
  if (await main.isVisible().catch(() => false)) {
    await main.screenshot({ path: path.join(OUT, file) });
    return;
  }
  await page.screenshot({ path: path.join(OUT, file) });
}

async function clipGameLevel(page, file) {
  const bay = page.locator(".game-level-frame").first();
  if (await bay.isVisible().catch(() => false)) {
    await bay.screenshot({ path: path.join(OUT, file) });
    return;
  }
  await clipMain(page, file);
}

async function openSection(page, label) {
  const link = page.getByRole("button", { name: label }).or(page.getByRole("link", { name: label }));
  if (await link.first().isVisible().catch(() => false)) {
    await link.first().click();
    await page.waitForTimeout(800);
  }
}

async function runInvestigation(page, waitMs = 28000) {
  const btn = page.getByRole("button", { name: /Run investigation/i });
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(waitMs);
  }
}

async function captureScreenshots(page) {
  console.log("— Screenshots —");

  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1500);
  await clipMain(page, "01-dashboard.png");

  await page.goto(`${BASE}/crm`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
  await clipMain(page, "08-crm.png");

  const incidentUrl = `${BASE}/incidents/${INCIDENT}`;
  await page.goto(incidentUrl, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1200);

  await openSection(page, "Timeline");
  await clipMain(page, "09-timeline.png");

  await openSection(page, "Transcripts");
  await clipMain(page, "10-transcript.png");

  await openSection(page, "Themes");
  await clipMain(page, "11-themes.png");

  await openSection(page, "Theories");
  await page.waitForTimeout(500);
  await clipGameLevel(page, "02-incident-theories.png");

  const runBtn = page.getByRole("button", { name: /Run investigation/i });
  if (await runBtn.isVisible().catch(() => false)) {
    await runBtn.click();
    await page.waitForTimeout(10000);
    await clipGameLevel(page, "03-investigation-live.png");
    await page.waitForTimeout(10000);
    await clipGameLevel(page, "04-investigation-debate.png");
    await page.waitForTimeout(18000);
  }

  await openSection(page, "Reports");
  await page.waitForTimeout(1500);
  await clipMain(page, "06-incident-report-complete.png");

  await openSection(page, "Agents");
  await page.waitForTimeout(800);
  await clipMain(page, "12-agents-bay.png");

  await page.goto(`${BASE}/guide`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
  await clipMain(page, "05-guide.png");
}

async function recordDemoVideo(browser) {
  console.log("— Demo video —");
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2000);

  await page.goto(`${BASE}/incidents/${INCIDENT}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1500);

  await openSection(page, "Theories");
  await page.waitForTimeout(1000);

  const btn = page.getByRole("button", { name: /Run investigation/i });
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
  }

  await page.waitForTimeout(36000);

  await openSection(page, "Reports");
  await page.waitForTimeout(3000);

  const video = page.video();
  await page.close();
  await context.close();

  if (video) {
    const webmPath = await video.path();
    const dest = path.join(OUT, "incident-room-demo.webm");
    fs.copyFileSync(webmPath, dest);
    console.log("Video:", dest);
  }
}

const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

try {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 15000 });
} catch (e) {
  console.error("Start dev server first: npm run dev");
  console.error(e.message);
  process.exit(1);
}

await captureScreenshots(page);
await context.close();

await recordDemoVideo(browser);
await browser.close();

fs.rmSync(VIDEO_DIR, { recursive: true, force: true });
console.log("Done:", fs.readdirSync(OUT).join(", "));
