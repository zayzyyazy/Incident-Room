/**
 * Full demo video: desk → incident tabs → complete investigation → report.
 * Prereq: npm run dev
 *
 *   npm run record-full-demo
 *   BASE_URL=http://localhost:3000 npm run record-full-demo
 */
import fs from "node:fs";
import path from "node:path";

const localBrowsers = path.join(process.cwd(), ".playwright-browsers");
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(localBrowsers)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowsers;
}

const { chromium } = await import("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const INCIDENT = process.env.DEMO_INCIDENT ?? "retell_call_clinic_44102";
const OUT = path.join(process.cwd(), "docs/screenshots");
const VIDEO_DIR = path.join(OUT, "full-demo-video-tmp");
const DEST = path.join(OUT, "incident-room-full-demo.webm");

fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(VIDEO_DIR, { recursive: true, force: true });
fs.mkdirSync(VIDEO_DIR, { recursive: true });

function resolveChromiumExecutable() {
  const pb = process.env.PLAYWRIGHT_BROWSERS_PATH ?? localBrowsers;
  for (const root of ["chrome-mac-arm64", "chrome-mac-x64"]) {
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
  return chromium.launch({
    headless: true,
    timeout: 60_000,
    executablePath: resolveChromiumExecutable(),
  });
}

async function pause(page, ms) {
  await page.waitForTimeout(ms);
}

async function openSection(page, label) {
  const link = page
    .getByRole("button", { name: label })
    .or(page.getByRole("link", { name: label }));
  if (await link.first().isVisible().catch(() => false)) {
    await link.first().click();
    await pause(page, 900);
  }
}

async function waitForInvestigationComplete(page, timeoutMs = 150_000) {
  try {
    await page.getByText("Cleared ✓").waitFor({ state: "visible", timeout: timeoutMs });
    return true;
  } catch {
    const live = page.getByText("LIVE", { exact: false });
    if (await live.isVisible().catch(() => false)) {
      console.warn("Timed out waiting for Cleared — investigation may still be running.");
      return false;
    }
    return true;
  }
}

async function recordFullDemo() {
  console.log("Recording full investigation demo…");
  console.log(`  Base: ${BASE}`);
  console.log(`  Incident: ${INCIDENT}`);

  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  try {
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 90_000 });
    await pause(page, 2500);

    await page.getByRole("link", { name: new RegExp(INCIDENT.slice(0, 20)) }).first().click().catch(async () => {
      await page.goto(`${BASE}/incidents/${INCIDENT}`, { waitUntil: "networkidle", timeout: 90_000 });
    });
    await pause(page, 2000);

    await openSection(page, "Timeline");
    await pause(page, 3500);

    await openSection(page, "Transcripts");
    await pause(page, 3000);

    await openSection(page, "Themes");
    await pause(page, 2500);

    await openSection(page, "Theories");
    await pause(page, 2000);

    const runBtn = page.getByRole("button", { name: /Run investigation/i });
    if (!(await runBtn.isVisible().catch(() => false))) {
      throw new Error("Run investigation button not found on Theories tab.");
    }
    await runBtn.click();
    console.log("  Investigation started — waiting for completion…");

    const done = await waitForInvestigationComplete(page);
    if (done) console.log("  Investigation cleared.");
    await pause(page, 4000);

    await openSection(page, "Reports");
    await pause(page, 5000);

    await openSection(page, "Agents");
    await pause(page, 3500);

    await page.goto(`${BASE}/crm`, { waitUntil: "networkidle", timeout: 60_000 });
    await pause(page, 3500);

    await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
    await pause(page, 2000);
  } finally {
    const video = page.video();
    await page.close();
    await context.close();
    await browser.close();

    if (video) {
      const webmPath = await video.path();
      fs.copyFileSync(webmPath, DEST);
      const stat = fs.statSync(DEST);
      console.log(`Video saved: ${DEST} (${(stat.size / 1024 / 1024).toFixed(1)} MiB)`);
    }
    fs.rmSync(VIDEO_DIR, { recursive: true, force: true });
  }
}

try {
  const probe = await fetch(BASE, { signal: AbortSignal.timeout(5000) });
  if (!probe.ok && probe.status !== 404) {
    console.warn(`Dev server responded ${probe.status} — continuing anyway.`);
  }
} catch {
  console.error(`Start dev server first: npm run dev  (${BASE} unreachable)`);
  process.exit(1);
}

await recordFullDemo();
