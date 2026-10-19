import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { IosConfig } from "./config";
import { failure, type CommandRunner } from "./runner";

const EXTRACT_TIMEOUT_MS = 10 * 60_000;
const PLIST_TIMEOUT_MS = 10_000;
const MAX_DEPTH = 3;
const TAR_ARCHIVE = /\.(tar\.gz|tgz)$/i;
const ZIP_ARCHIVE = /\.zip$/i;

export const BUNDLE_MESSAGES = {
  unsupported: "Only simulator builds packed as .tar.gz, .tgz or .zip can be installed",
  noApp: "The archive contains no .app bundle",
} as const;

export const isSupportedArchive = (fileName: string) => TAR_ARCHIVE.test(fileName) || ZIP_ARCHIVE.test(fileName);

/** Unpacks an archive into `dir` (bsdtar refuses absolute and `..` paths; `ditto` on macOS, `unzip` elsewhere). */
export async function extractArchive(config: IosConfig, runner: CommandRunner, archive: string, fileName: string, dir: string): Promise<void> {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  let cmd: string[];
  if (TAR_ARCHIVE.test(fileName)) cmd = ["tar", "-xzf", archive, "-C", dir];
  else if (ZIP_ARCHIVE.test(fileName)) cmd = config.platform === "darwin" ? ["ditto", "-x", "-k", archive, dir] : ["unzip", "-q", archive, "-d", dir];
  else throw new Error(BUNDLE_MESSAGES.unsupported);
  const result = await runner(cmd, { env: config.env, timeoutMs: EXTRACT_TIMEOUT_MS });
  if (!result.ok) throw failure(result, `Extracting ${fileName}`);
}

const isDir = (path: string) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/** `dir` itself when it is an app bundle (Expo Go's archive holds the bundle's contents), else the first `.app` within 3 levels. */
export function findApp(dir: string, depth = 0): string | null {
  if (dir.endsWith(".app") && existsSync(join(dir, "Info.plist"))) return dir;
  if (depth >= MAX_DEPTH) return null;
  let entries: string[];
  try {
    entries = readdirSync(dir).sort();
  } catch {
    return null;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    if (entry.startsWith(".") || !isDir(path)) continue;
    const found = findApp(path, depth + 1);
    if (found) return found;
  }
  return null;
}

/** `CFBundleIdentifier` of an app bundle (`plutil`, macOS); null when it cannot be read. */
export async function bundleId(config: IosConfig, runner: CommandRunner, app: string): Promise<string | null> {
  const result = await runner(["plutil", "-extract", "CFBundleIdentifier", "raw", "-o", "-", join(app, "Info.plist")], { env: config.env, timeoutMs: PLIST_TIMEOUT_MS });
  const id = result.stdout.trim();
  return result.ok && id ? id : null;
}
