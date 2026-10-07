import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const REPO_ROOT = resolve(APP_DIR, "..", "..");
export const OUT_DIR = join(APP_DIR, "out");
export const MAIN_ENTRY = join(OUT_DIR, "main", "index.js");
export const BUILD_OUTPUTS = [MAIN_ENTRY, join(OUT_DIR, "preload", "index.cjs"), join(OUT_DIR, "renderer", "index.html")];
export const CLI_DIST_DIR = join(APP_DIR, "dist-cli");
export const SANDBOX_BUNDLE_DIR = join(APP_DIR, "build", "sandbox-context");
export const SOURCE_INPUTS = ["src", "electron.vite.config.ts", "package.json", "tsconfig.json"].map((path) => join(APP_DIR, path));
export const WORKSPACE_INPUTS = ["packages/protocol/src", "packages/client/src"].map((path) => join(REPO_ROOT, path));

export function resolveOutput(path: string): string {
  return resolve(APP_DIR, path);
}

export function resolveInput(path: string): string {
  const local = resolve(APP_DIR, path);
  return existsSync(local) ? local : resolve(REPO_ROOT, path);
}
