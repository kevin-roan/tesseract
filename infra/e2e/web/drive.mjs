import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const env = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`${name} is not set`);
  return value;
};

const app = env("TESSERACT_WEB_APP", "http://127.0.0.1:8081");
const controller = env("TESSERACT_WEB_CONTROLLER", "http://127.0.0.1:7700");
const token = env("TESSERACT_WEB_TOKEN");
const name = env("TESSERACT_WEB_NAME", "e2e");
const project = env("TESSERACT_WEB_PROJECT", "electron-hello");
const out = env("TESSERACT_WEB_OUT", "/tmp/tesseract-e2e-web-shots");
const chromiumPath = env("TESSERACT_WEB_CHROMIUM", "/usr/bin/chromium");
const TIMEOUT_MS = 30_000;

mkdirSync(out, { recursive: true });
const checks = [];
const problems = [];

async function check(label, run) {
  try {
    await run();
    checks.push({ label, passed: true });
  } catch (error) {
    checks.push({ label, passed: false, error: String(error?.message ?? error).split("\n")[0] });
    throw error;
  }
}

const browser = await chromium.launch({ executablePath: chromiumPath, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.setDefaultTimeout(TIMEOUT_MS);
page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") problems.push(`console: ${message.text()}`);
});
const shot = (file) => page.screenshot({ path: join(out, file), fullPage: true });
const onScreen = (text, options = {}) =>
  page.getByText(text, { exact: typeof text === "string", ...options }).filter({ visible: true }).first();
const visible = (text, options) => onScreen(text, options).waitFor({ state: "visible" });

let failed = false;
try {
  const query = new URLSearchParams({ url: controller, token, name });
  await check("pair screen opens from the link", async () => {
    await page.goto(`${app}/pair?${query}`, { waitUntil: "networkidle" });
    await visible("Pair sandbox");
    await visible("Opened from a pairing link");
  });
  await shot("01-pair.png");

  await check("pairing lands on the Agents hub", async () => {
    await onScreen("Pair sandbox").click();
    await page.waitForURL((url) => url.pathname.endsWith("/agents"));
    await visible("Quick actions");
  });

  await check("hub shows the sandbox name", () => visible(name));
  await check("hub shows resource stats", async () => {
    for (const label of ["CPU load", "Memory", "Workspace disk"]) await visible(label);
  });
  await check("hub lists the project", () => visible(project));
  await page.waitForTimeout(1_000);
  await shot("02-hub.png");

  await check("project screen opens with its build targets", async () => {
    await onScreen(project).click();
    await page.waitForURL((url) => url.pathname.includes(`/sandbox/projects/${project}`));
    await visible("Build");
    await visible("Linux AppImage");
    await visible("Windows installer");
  });
  await page.waitForTimeout(1_000);
  await shot("03-project.png");

  await check("project screen lists builds and artifacts", async () => {
    await visible("Recent builds");
    await visible("Artifacts");
    await visible(/\.AppImage$/);
    await visible(/\.exe$/);
  });

  await check("a build opens from the list", async () => {
    await onScreen("Recent builds").scrollIntoViewIfNeeded();
    await onScreen("Succeeded").click();
    await page.waitForURL((url) => url.pathname.includes("/sandbox/builds/"));
    await visible("Succeeded");
    await visible(/Build succeeded/);
  });
  await page.waitForTimeout(1_000);
  await shot("04-build.png");
} catch {
  failed = true;
  await shot("99-failure.png").catch(() => undefined);
} finally {
  await browser.close();
}

console.log(JSON.stringify({ checks, problems, screenshots: out }, null, 2));
process.exit(failed ? 1 : 0);
