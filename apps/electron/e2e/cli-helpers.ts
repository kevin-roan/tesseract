import { spawn, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { SANDBOX_PREFIX } from "../scripts/lib/electron.ts";
import { APP_DIR, REPO_ROOT } from "../scripts/lib/paths.ts";
import { findTarget, hostTargetId } from "../scripts/lib/targets.ts";

export const CLI_ENTRY = join(APP_DIR, "cli", "index.ts");
export const CLI_PREBUILT_ENV = "MONOLITH_E2E_CLI";
export const CLI_BUILD_TIMEOUT_MS = 180_000;
export const CLI_RUN_TIMEOUT_MS = 60_000;
export const ANDROID_FIXTURES_DIR = join(APP_DIR, "src", "core", "android", "fixtures");
export const ANDROID_CATALOG = [
  { file: "repository2-3.xml", url: "https://dl.google.com/android/repository/repository2-3.xml" },
  { file: "sys-img2-3.xml", url: "https://dl.google.com/android/repository/sys-img/google_apis/sys-img2-3.xml" },
] as const;
export const TEST_TOKEN = "monolith-test-token-0123456789abcdef";
export const UNREACHABLE_URL = "http://127.0.0.1:9";

const INHERITED_OVERRIDES = [
  "MONOLITH_DESKTOP_CONFIG",
  "MONOLITH_USER_DATA",
  "MONOLITH_STATE_DIR",
  "MONOLITH_APP_PATH",
  "MONOLITH_SANDBOX_CONTEXT",
  "MONOLITH_FIXTURES",
  "MONOLITH_SNAPSHOT",
  "XDG_CONFIG_HOME",
  "XDG_STATE_HOME",
  "XDG_CACHE_HOME",
  "XDG_DATA_HOME",
  "ANDROID_HOME",
  "ANDROID_SDK_ROOT",
  "ANDROID_USER_HOME",
  "ANDROID_AVD_HOME",
  "ANDROID_EMULATOR_HOME",
  "THEONE_TOKEN",
  "THEONE_URL",
  "THEONE_API_URL",
  "NO_COLOR",
];

export interface BuiltCli {
  path: string;
  dispose(): void;
}

export function buildHostCli(): BuiltCli {
  const prebuilt = process.env[CLI_PREBUILT_ENV];
  if (prebuilt) return { path: prebuilt, dispose: () => undefined };
  const target = findTarget(hostTargetId());
  const dir = mkdtempSync(join(tmpdir(), `${SANDBOX_PREFIX}cli-`));
  const path = join(dir, `monolith${target.exe}`);
  const result = spawnSync(
    "bun",
    ["build", CLI_ENTRY, "--compile", "--minify", `--target=${target.bunTarget}`, "--outfile", path],
    { cwd: APP_DIR, encoding: "utf8", timeout: CLI_BUILD_TIMEOUT_MS },
  );
  if (result.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(`bun build --compile failed (${target.id}):\n${result.stderr || result.stdout}`);
  }
  return { path, dispose: () => rmSync(dir, { recursive: true, force: true }) };
}

export interface CliHome {
  dir: string;
  home: string;
  userData: string;
  configFile: string;
  bin: string;
  env: NodeJS.ProcessEnv;
  dispose(): void;
}

export function createCliHome(extraEnv: NodeJS.ProcessEnv = {}): CliHome {
  const dir = mkdtempSync(join(tmpdir(), `${SANDBOX_PREFIX}home-`));
  const home = join(dir, "home");
  const userData = join(dir, "user-data");
  const bin = join(dir, "bin");
  for (const path of [home, userData, bin]) mkdirSync(path, { recursive: true });
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of INHERITED_OVERRIDES) delete env[key];
  Object.assign(env, {
    HOME: home,
    USERPROFILE: home,
    APPDATA: join(home, "AppData", "Roaming"),
    LOCALAPPDATA: join(home, "AppData", "Local"),
    MONOLITH_USER_DATA: userData,
    MONOLITH_SANDBOX_CONTEXT: REPO_ROOT,
    DOCKER_CONFIG: process.env.DOCKER_CONFIG ?? join(homedir(), ".docker"),
    NO_COLOR: "1",
    ...extraEnv,
  });
  return {
    dir,
    home,
    userData,
    configFile: join(home, ".config", "monolith-desktop", "config.json"),
    bin,
    env,
    dispose: () => rmSync(dir, { recursive: true, force: true }),
  };
}

export interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export function runCli(cli: string, args: readonly string[], env: NodeJS.ProcessEnv, cwd = REPO_ROOT): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cli, [...args], { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    const timer = setTimeout(() => child.kill("SIGKILL"), CLI_RUN_TIMEOUT_MS);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

export function parseJson<T = Record<string, unknown>>(result: CliResult): T {
  try {
    return JSON.parse(result.stdout) as T;
  } catch {
    throw new Error(`stdout is not JSON (exit ${result.code}):\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
}

export function seedAndroidCatalog(userData: string, fetchedAt = Date.now()): string {
  const cacheDir = join(userData, "android", "cache");
  mkdirSync(cacheDir, { recursive: true });
  for (const { file, url } of ANDROID_CATALOG) {
    copyFileSync(join(ANDROID_FIXTURES_DIR, file), join(cacheDir, file));
    writeFileSync(join(cacheDir, `${file}.meta.json`), JSON.stringify({ url, etag: null, lastModified: null, fetchedAt }));
  }
  return cacheDir;
}

export function writeConfig(file: string, data: Record<string, unknown>): void {
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

export function writeEnvFile(file: string, values: Record<string, string>): void {
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n")}\n`);
}

export function isolatedStackEnv(userData: string): string {
  const file = join(userData, "sandbox", ".env");
  writeEnvFile(file, { THEONE_COMPOSE_PROJECT: `${SANDBOX_PREFIX}absent-${process.pid}`, THEONE_CONTROLLER_HOST_PORT: "9" });
  return file;
}

export function writeRecorder(dir: string, name: string): { path: string; log: string } {
  const path = join(dir, name);
  const log = join(dir, `${name}.args`);
  writeFileSync(path, `#!/bin/sh\nprintf '%s\\n' "$@" > '${log}'\n`);
  chmodSync(path, 0o755);
  return { path, log };
}

export async function waitForFile(path: string, timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(path)) {
      const text = readFileSync(path, "utf8");
      if (text) return text;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for ${path}`);
}

export function dockerAvailable(): boolean {
  return spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8", timeout: 15_000 }).status === 0;
}

export const E2E_STACK = {
  url: process.env.THEONE_E2E_URL ?? "",
  token: process.env.THEONE_E2E_TOKEN ?? "",
  project: process.env.THEONE_E2E_PROJECT ?? "theone-e2e",
  envFile: process.env.THEONE_E2E_ENV_FILE ?? "",
  image: process.env.THEONE_E2E_IMAGE ?? "theone/sandbox:e2e",
};
