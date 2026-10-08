import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { accessSync, constants, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { APP_DIR, REPO_ROOT } from "../scripts/lib/paths.ts";
import { artifactName } from "../scripts/lib/smoke.ts";

export const DIST_MODE_ENV = "TESSERACT_E2E_DIST";
export type DistMode = "always" | "stale" | "never";

export const DIST_TIMEOUT_MS = 30 * 60_000;
export const EXTRACT_TIMEOUT_MS = 5 * 60_000;
export const LAUNCH_TIMEOUT_MS = 90_000;
export const QUIT_TIMEOUT_MS = 30_000;

export const DIST_INPUTS = [
  "src",
  "cli",
  "package.json",
  "electron.vite.config.ts",
  "electron-builder.yml",
  "build/installer.nsh",
  "build/linux",
  "build/icons",
  "scripts/dist.ts",
  "scripts/cli-build.ts",
  "scripts/bundle-sandbox.ts",
].map((path) => join(APP_DIR, path));

export const DIST_WORKSPACE_INPUTS = ["packages/protocol/src", "packages/client/src", "apps/controller/src", "infra/docker/sandbox"].map((path) =>
  join(REPO_ROOT, path),
);

export const NSIS_CLI_DIR = "$INSTDIR\\resources\\bin";
export const NSIS_PATH_MARKERS = [
  `!define TESSERACT_CLI_DIR "${NSIS_CLI_DIR}"`,
  "!macro customInstall",
  'Push "add"',
  "!macro customUnInstall",
  'Push "remove"',
  'WriteRegExpandStr HKCU "${TESSERACT_ENV_KEY}" "${TESSERACT_PATH_VALUE}"',
  "WM_SETTINGCHANGE",
] as const;

export const CLI_EXTRA_RESOURCE = { from: "dist-cli/${os}-${arch}", to: "bin" } as const;
export const SANDBOX_EXTRA_RESOURCE = { from: "build/sandbox-context", to: "sandbox" } as const;

export interface BuilderTarget {
  target: string;
  arch?: string[];
}

export interface BuilderConfig {
  appId: string;
  productName: string;
  asar: boolean;
  extraResources: { from: string; to: string; filter?: string[] }[];
  mac: { target: BuilderTarget[]; hardenedRuntime: boolean };
  dmg: { contents: { type: string; path?: string }[] };
  win: { target: BuilderTarget[]; executableName: string };
  nsis: { oneClick: boolean; perMachine: boolean; allowElevation: boolean; include: string };
  linux: { executableName: string; target: BuilderTarget[] };
  deb: { afterInstall: string; afterRemove: string };
}

export function readBuilderConfig(): BuilderConfig {
  return parse(readFileSync(join(APP_DIR, "electron-builder.yml"), "utf8")) as BuilderConfig;
}

export function appVersion(): string {
  return (JSON.parse(readFileSync(join(APP_DIR, "package.json"), "utf8")) as { version: string }).version;
}

export function appImagePath(version = appVersion()): string {
  return join(APP_DIR, "dist", artifactName(version, "AppImage"));
}

export function distMode(env: NodeJS.ProcessEnv = process.env): DistMode {
  const raw = env[DIST_MODE_ENV];
  return raw === "always" || raw === "never" ? raw : "stale";
}

function newestMtime(path: string): number {
  if (!existsSync(path)) return 0;
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.mtimeMs;
  let newest = stat.mtimeMs;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    newest = Math.max(newest, newestMtime(join(path, entry.name)));
  }
  return newest;
}

export function artifactIsStale(artifact: string): boolean {
  if (!existsSync(artifact)) return true;
  const built = statSync(artifact).mtimeMs;
  return [...DIST_INPUTS, ...DIST_WORKSPACE_INPUTS].some((input) => newestMtime(input) > built);
}

export function shouldBuild(mode: DistMode, artifact: string): boolean {
  if (mode === "always") return true;
  if (mode === "never") return false;
  return artifactIsStale(artifact);
}

export function run(file: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; timeout: number }): SpawnSyncReturns<string> {
  return spawnSync(file, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
}

export function runDist(): SpawnSyncReturns<string> {
  return run(process.execPath, ["scripts/dist.ts", "--platform", "linux"], { cwd: APP_DIR, timeout: DIST_TIMEOUT_MS });
}

export function extractAppImage(appImage: string, dir: string, env: NodeJS.ProcessEnv): string | null {
  const result = run(appImage, ["--appimage-extract"], { cwd: dir, env, timeout: EXTRACT_TIMEOUT_MS });
  const root = join(dir, "squashfs-root");
  return result.status === 0 && existsSync(root) ? root : null;
}

export function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function quitEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const next = { ...env };
  delete next.TESSERACT_SNAPSHOT;
  return next;
}

export function describeRun(result: SpawnSyncReturns<string>): string {
  return `exit ${result.status ?? result.signal}\n${result.stdout ?? ""}\n${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}`;
}

export function hasTool(name: string): boolean {
  return spawnSync("sh", ["-c", `command -v ${name}`], { encoding: "utf8" }).status === 0;
}
