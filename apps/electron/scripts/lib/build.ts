import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { APP_DIR, BUILD_OUTPUTS, SOURCE_INPUTS, WORKSPACE_INPUTS } from "./paths.ts";

export const BUILD_LOCK_DIR = join(APP_DIR, "node_modules", ".monolith-build.lock");
const LOCK_STALE_MS = 10 * 60_000;
const LOCK_POLL_MS = 250;
const LOCK_TIMEOUT_MS = 15 * 60_000;

function newestMtime(path: string): number {
  if (!existsSync(path)) return 0;
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.mtimeMs;
  let newest = stat.mtimeMs;
  for (const entry of readdirSync(path)) {
    if (entry === "node_modules") continue;
    newest = Math.max(newest, newestMtime(join(path, entry)));
  }
  return newest;
}

export function buildIsStale(outputs: readonly string[] = BUILD_OUTPUTS, inputs: readonly string[] = [...SOURCE_INPUTS, ...WORKSPACE_INPUTS]): boolean {
  if (!outputs.every((output) => existsSync(output))) return true;
  const built = Math.min(...outputs.map((output) => statSync(output).mtimeMs));
  return inputs.some((input) => newestMtime(input) > built);
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function tryLock(dir: string): boolean {
  try {
    mkdirSync(dir);
    return true;
  } catch {
    try {
      if (Date.now() - statSync(dir).mtimeMs > LOCK_STALE_MS) rmSync(dir, { recursive: true, force: true });
    } catch {
      return false;
    }
    return false;
  }
}

export function withBuildLock<T>(run: () => T, dir: string = BUILD_LOCK_DIR, timeoutMs: number = LOCK_TIMEOUT_MS): T {
  const deadline = Date.now() + timeoutMs;
  while (!tryLock(dir)) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for the build lock at ${dir}`);
    sleep(LOCK_POLL_MS);
  }
  try {
    return run();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function ensureBuild(force = false): void {
  if (!force && !buildIsStale()) return;
  withBuildLock(() => {
    if (!force && !buildIsStale()) return;
    const result = spawnSync("bun", ["run", "build"], { cwd: APP_DIR, stdio: "inherit" });
    if (result.status !== 0) throw new Error("electron-vite build failed");
  });
}
