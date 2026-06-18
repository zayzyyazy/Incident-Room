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
    .getByRole("button", { name: label, exact: true })
    .or(page.getByRole("link", { name: label, exact: true }));
  await link.first().click({ timeout: 8000 }).catch(() => {});
  await pause(page, 900);
}

async function clickStartInvestigation(page) {
  const runBtn = page.getByRole("button", { name: /^Run investigation$/i });
  const againBtn = page.getByRole("button", { name: /^Run again$/i });

  for (let attempt = 0; attempt < 3; attempt++) {
    if (await runBtn.isVisible().catch(() => false)) {
      await runBtn.click();
      return;
    }
    if (await againBtn.isVisible().catch(() => false)) {
      await againBtn.click();
      return;
    }
    await pause(page, 1500);
  }

  throw new Error(
    "Could not find Run investigation or Run again on Theories tab. Open the incident in browser and confirm the theories panel loaded.",
  );
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
  let ok = false;
  let failure = null;

  try {
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 90_000 });
    await pause(page, 2500);

    await page.goto(`${BASE}/incidents/${INCIDENT}`, {
      waitUntil: "networkidle",
      timeout: 90_000,
    });
    await page.waitForSelector("text=Theories", { timeout: 30_000 });
    await pause(page, 1500);

    await openSection(page, "Timeline");
    await pause(page, 3500);

    await openSection(page, "Transcripts");
    await pause(page, 3000);

    await openSection(page, "Themes");
    await pause(page, 2500);

    await openSection(page, "Theories");
    await pause(page, 2000);

    await clickStartInvestigation(page);
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
    ok = true;
  } catch (err) {
    failure = err instanceof Error ? err : new Error(String(err));
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

  if (failure) {
    console.error(failure.message);
    process.exit(1);
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
