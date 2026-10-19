import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { EXPO_GO_BUNDLE_ID, EXPO_VERSIONS_URL, LIMITS } from "@tesseract/protocol";
import type { Logger } from "../../core/logger";
import { BUNDLE_MESSAGES, extractArchive, findApp } from "./bundle";
import type { IosConfig } from "./config";
import type { Progress } from "./installs";
import type { CommandRunner } from "./runner";
import { saveVerified } from "./sandbox-api";
import type { Simctl } from "./simctl";

const VERSIONS_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 15 * 60_000;
const ARCHIVE_NAME = "expo-go.tar.gz";

export const EXPO_GO_MESSAGES = {
  noBuild: "Expo publishes no Expo Go simulator build for this SDK",
  notHttps: "The Expo Go build URL is not https",
} as const;

type VersionEntry = { iosClientUrl?: unknown };
type Versions = { iosUrl?: unknown; sdkVersions?: Record<string, VersionEntry> };

/** The Expo Go simulator build of `sdkVersion` (else the latest) from Expo's version index (spike: `data` wrapper). */
export function expoGoUrl(index: unknown, sdkVersion?: string): string | null {
  const root = (typeof index === "object" && index !== null ? index : {}) as { data?: Versions } & Versions;
  const versions = root.data ?? root;
  const forSdk = sdkVersion ? versions.sdkVersions?.[sdkVersion]?.iosClientUrl : undefined;
  const url = typeof forSdk === "string" ? forSdk : versions.iosUrl;
  return typeof url === "string" && url ? url : null;
}

export type ExpoGoDeps = {
  config: IosConfig;
  runner: CommandRunner;
  simctl: Simctl;
  tmpDir: () => string;
  logger: Logger;
  fetcher?: typeof fetch;
};

/** Installs Expo Go from Expo's published simulator build when the device lacks it; never from the sandbox. */
export async function ensureExpoGo(deps: ExpoGoDeps, udid: string, sdkVersion: string | undefined, progress: Progress): Promise<boolean> {
  if (await deps.simctl.installed(udid, EXPO_GO_BUNDLE_ID)) return false;
  progress("installing_expo_go");
  const fetcher = deps.fetcher ?? fetch;
  const index = await fetcher(EXPO_VERSIONS_URL, { signal: AbortSignal.timeout(VERSIONS_TIMEOUT_MS) });
  if (!index.ok) throw new Error(`Expo's version index answered HTTP ${index.status}`);
  const url = expoGoUrl(await index.json(), sdkVersion);
  if (!url) throw new Error(EXPO_GO_MESSAGES.noBuild);
  if (!url.startsWith("https://")) throw new Error(EXPO_GO_MESSAGES.notHttps);
  const dir = mkdtempSync(join(deps.tmpDir(), "expo-go-"));
  try {
    const response = await fetcher(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Downloading Expo Go failed (HTTP ${response.status})`);
    const archive = join(dir, ARCHIVE_NAME);
    await saveVerified(response, archive, null, LIMITS.maxIosInstallBytes);
    const target = join(dir, "Expo Go.app");
    await extractArchive(deps.config, deps.runner, archive, ARCHIVE_NAME, target);
    const app = findApp(target);
    if (!app) throw new Error(BUNDLE_MESSAGES.noApp);
    await deps.simctl.install(udid, app);
    deps.logger.info("expo go installed", { udid, sdkVersion: sdkVersion ?? "latest" });
    return true;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
