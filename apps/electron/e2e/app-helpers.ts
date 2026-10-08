import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page, TestInfo } from "@playwright/test";
import { TesseractClient } from "@tesseract/client";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { COMPLETED_ONBOARDING } from "./app";

export const SNAPSHOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "__snapshots__");
export const UPDATE_SNAPSHOTS_ENV = "TESSERACT_UPDATE_SNAPSHOTS";
export const PIXEL_THRESHOLD = 0.1;
export const MAX_MISMATCH_PERCENT = 0.5;
export const LIVE_TIMEOUT_MS = 30_000;
export const OFFLINE_URL = "http://127.0.0.1:9";
export const OFFLINE_TOKEN = "tesseract-test-offline-token";
export const LIVE_SANDBOX_NAME = "tesseract-e2e";
export const TEST_PREFIX = "tesseract-e2e";
export const SNAPSHOT_CLOCK = "2026-10-07T09:00:00.000Z";
export const SNAPSHOT_ENV = { TZ: "UTC", LANG: "en_US.UTF-8" } as const;

export interface LiveStack {
  url: string;
  token: string;
  project: string;
}

interface IdleWindow {
  __tesseractIdle?: () => Promise<boolean>;
  location: { hash: string };
}

export function liveStack(): LiveStack | null {
  const url = process.env.TESSERACT_E2E_URL?.trim();
  const token = process.env.TESSERACT_E2E_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token, project: process.env.TESSERACT_E2E_PROJECT?.trim() || LIVE_SANDBOX_NAME };
}

export function assertTestStack(stack: LiveStack): void {
  if (!stack.project.startsWith("tesseract-e2e")) {
    throw new Error(`TESSERACT_E2E_PROJECT must start with tesseract-e2e (got ${stack.project}); refusing to mutate another sandbox`);
  }
}

export function connectionConfig(url: string, token: string, name = LIVE_SANDBOX_NAME): Record<string, unknown> {
  return { ...COMPLETED_ONBOARDING, url, token, name };
}

export function apiClient(stack: LiveStack): TesseractClient {
  return new TesseractClient({ baseUrl: stack.url, token: stack.token, timeoutMs: LIVE_TIMEOUT_MS });
}

export function uniqueName(kind: string): string {
  return `${TEST_PREFIX}-${kind}-${Date.now().toString(36)}`;
}

export async function waitIdle(window: Page): Promise<void> {
  await window.evaluate(() => (globalThis as unknown as IdleWindow).__tesseractIdle?.());
}

export async function goTo(window: Page, route: string): Promise<void> {
  await window.evaluate((hash) => {
    (globalThis as unknown as IdleWindow).location.hash = hash;
  }, route);
  await waitIdle(window);
}

export async function stillWindow(window: Page): Promise<void> {
  await window.clock.setFixedTime(new Date(SNAPSHOT_CLOCK));
  await window.emulateMedia({ reducedMotion: "reduce" });
  await window.reload();
  await window.waitForLoadState("domcontentloaded");
  await waitIdle(window);
}

export async function readTerminalOutput(client: TesseractClient, id: string, timeoutMs = LIVE_TIMEOUT_MS): Promise<string> {
  const chunks: string[] = [];
  const connection = client.openTerminal(id, { onOutput: (data) => chunks.push(data) });
  const deadline = Date.now() + timeoutMs;
  try {
    while (chunks.length === 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
    await new Promise((resolve) => setTimeout(resolve, 300));
    return chunks.join("");
  } finally {
    connection.close();
  }
}

const ANSI_PATTERN = /\x1b(?:\[[0-9;?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[@-Z\\-_])/g;

export function plainTerminalText(output: string): string {
  return output.replace(ANSI_PATTERN, "").replace(/\r/g, "");
}

export interface SnapshotResult {
  percent: number;
  created: boolean;
}

function updateRequested(info: TestInfo): boolean {
  return process.env[UPDATE_SNAPSHOTS_ENV] === "1" || info.config.updateSnapshots === "all" || info.config.updateSnapshots === "changed";
}

function mismatch(actual: PNG, expected: PNG, diff: PNG): number {
  const width = Math.min(actual.width, expected.width);
  const height = Math.min(actual.height, expected.height);
  const crop = (image: PNG) => {
    const out = new PNG({ width, height });
    PNG.bitblt(image, out, 0, 0, width, height, 0, 0);
    return out.data;
  };
  const changed = pixelmatch(crop(actual), crop(expected), diff.data, width, height, { threshold: PIXEL_THRESHOLD });
  const total = Math.max(actual.width, expected.width) * Math.max(actual.height, expected.height);
  return ((changed + total - width * height) / total) * 100;
}

export function compareSnapshot(image: Buffer, name: string, info: TestInfo): SnapshotResult {
  const baseline = join(SNAPSHOT_DIR, `${name}.png`);
  if (!existsSync(baseline) || updateRequested(info)) {
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
    writeFileSync(baseline, image);
    return { percent: 0, created: true };
  }
  const actual = PNG.sync.read(image);
  const expected = PNG.sync.read(readFileSync(baseline));
  const diff = new PNG({ width: Math.min(actual.width, expected.width), height: Math.min(actual.height, expected.height) });
  const percent = mismatch(actual, expected, diff);
  if (percent > MAX_MISMATCH_PERCENT) {
    writeFileSync(info.outputPath(`${name}-actual.png`), image);
    writeFileSync(info.outputPath(`${name}-diff.png`), PNG.sync.write(diff));
  }
  return { percent, created: false };
}
