import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Env } from "../../core/exec";
import { parseSwitch } from "../android/config";
import { HostConfigError, hostToolPath } from "../config";

export type IosConfig = {
  /** `TESSERACT_IOS`: off unless set; when off `GET /v1/ios` is `available: false` with `reasonCode: "disabled"`. */
  enabled: boolean;
  platform: NodeJS.Platform;
  xcrun: string | null;
  idb: string | null;
  idbCompanion: string | null;
  /** Environment of every Simulator tool: the daemon's, without its own settings, PATH with Homebrew and pip prefixes. */
  env: Record<string, string>;
};

const XCRUN = "/usr/bin/xcrun";

/** Where `pip install --user fb-idb` and pipx put `idb` on macOS (not on launchd's PATH). */
function pythonBins(home: string, exists: (path: string) => boolean): string[] {
  const base = join(home, "Library", "Python");
  const dirs: string[] = [join(home, ".local", "bin")];
  try {
    for (const version of readdirSync(base).sort().reverse()) dirs.push(join(base, version, "bin"));
  } catch {}
  return dirs.filter(exists);
}

function executable(override: string | undefined, fallback: string, path: string, exists: (path: string) => boolean): string | null {
  if (override) return override.includes("/") ? (exists(override) ? override : null) : Bun.which(override, { PATH: path });
  return Bun.which(fallback, { PATH: path });
}

export function toolEnv(source: Env, path: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(source)) if (value !== undefined && !name.startsWith("TESSERACT_")) env[name] = value;
  env.PATH = path;
  return env;
}

/** Never throws for a missing tool (the status explains it); only an invalid `TESSERACT_IOS` stops startup. */
export function loadIosConfig(source: Env, platform: NodeJS.Platform = process.platform, exists: (path: string) => boolean = existsSync): IosConfig {
  const enabled = parseSwitch(source.TESSERACT_IOS);
  if (enabled === null) throw new HostConfigError(`TESSERACT_IOS must be on or off, got ${source.TESSERACT_IOS}`);
  const darwin = platform === "darwin";
  const home = source.HOME || homedir();
  const path = [hostToolPath(source, platform), ...(darwin ? pythonBins(home, exists) : [])].filter(Boolean).join(":");
  const xcrun = source.TESSERACT_XCRUN ? executable(source.TESSERACT_XCRUN, "xcrun", path, exists) : darwin && exists(XCRUN) ? XCRUN : Bun.which("xcrun", { PATH: path });
  return {
    enabled,
    platform,
    xcrun,
    idb: executable(source.TESSERACT_IDB, "idb", path, exists),
    idbCompanion: executable(source.TESSERACT_IDB_COMPANION, "idb_companion", path, exists),
    env: toolEnv(source, path),
  };
}
