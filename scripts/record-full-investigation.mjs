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
const FIXTURE = path.join(
  process.cwd(),
  "fixtures/seeded/test-retell-clinic-44102.json",
);
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

async function ensureDemoIncident() {
  const check = await fetch(`${BASE}/api/incidents/${INCIDENT}`);
  if (check.ok) {
    console.log("  Incident ready.");
    return;
  }

  if (!fs.existsSync(FIXTURE)) {
    throw new Error(`Fixture missing: ${FIXTURE}`);
  }

  console.log(`  Seeding ${INCIDENT}…`);
  const evidence = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
  const post = await fetch(`${BASE}/api/incidents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ evidence }),
  });
  const body = await post.text();
  if (!post.ok) {
    throw new Error(`Failed to seed incident (${post.status}): ${body.slice(0, 200)}`);
  }
}

async function openSection(page, sectionId) {
  const btn = page.getByTestId(`investigation-nav-${sectionId}`);
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await pause(page, 900);
  }
}

async function waitForTheoriesReady(page) {
  await page
    .getByText("Loading incident")
    .waitFor({ state: "hidden", timeout: 90_000 })
    .catch(() => {});

  if (await page.getByText("Incident not found").isVisible().catch(() => false)) {
    throw new Error(`${INCIDENT} not found — seed failed or wrong BASE_URL.`);
  }

  const ready = page
    .getByTestId("investigation-run")
    .or(page.getByTestId("investigation-run-again"))
    .or(page.getByText("Investigation Bay"));

  await ready.first().waitFor({ state: "visible", timeout: 90_000 });
}

async function clickStartInvestigation(page) {
  const runBtn = page.getByTestId("investigation-run");
  const againBtn = page.getByTestId("investigation-run-again");

  for (let attempt = 0; attempt < 5; attempt++) {
    if (await runBtn.isVisible().catch(() => false)) {
      await runBtn.click();
      return;
    }
    if (await againBtn.isVisible().catch(() => false)) {
      await againBtn.click();
      return;
    }
    await openSection(page, "theories");
    await pause(page, 1200);
  }

  throw new Error("Run investigation / Run again not found on Theories tab.");
}

async function waitForInvestigationComplete(page, timeoutMs = 180_000) {
  try {
    await page.getByText("Cleared ✓").waitFor({ state: "visible", timeout: timeoutMs });
    return true;
  } catch {
    if (await page.getByText("LIVE", { exact: false }).isVisible().catch(() => false)) {
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

  await ensureDemoIncident();

  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1536, height: 960 },
    deviceScaleFactor: 1,
    recordVideo: { dir: VIDEO_DIR, size: { width: 1536, height: 960 } },
  });
  const page = await context.newPage();
  let failure = null;

  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await pause(page, 2000);

    await page.goto(`${BASE}/incidents/${INCIDENT}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });

    await waitForTheoriesReady(page);
    await pause(page, 1500);

    await openSection(page, "timeline");
    await pause(page, 3500);

    await openSection(page, "transcripts");
    await pause(page, 3000);

    await openSection(page, "themes");
    await pause(page, 2500);

    await openSection(page, "theories");
    await pause(page, 2000);

    await clickStartInvestigation(page);
    console.log("  Investigation started — waiting for completion…");

    const done = await waitForInvestigationComplete(page);
    if (done) console.log("  Investigation cleared.");
    await pause(page, 4000);

    await openSection(page, "reports");
    await pause(page, 5000);

    await openSection(page, "agents");
    await pause(page, 3500);

    await page.goto(`${BASE}/crm`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await pause(page, 3500);

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await pause(page, 2000);
  } catch (err) {
    failure = err instanceof Error ? err : new Error(String(err));
    await page
      .screenshot({ path: path.join(OUT, "record-full-demo-failure.png"), fullPage: true })
      .catch(() => {});
    console.error("  Debug screenshot: docs/screenshots/record-full-demo-failure.png");
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
  await fetch(BASE, { signal: AbortSignal.timeout(8000) });
} catch {
  console.error(`Start dev server first: npm run dev  (${BASE} unreachable)`);
  process.exit(1);
}

await recordFullDemo();
