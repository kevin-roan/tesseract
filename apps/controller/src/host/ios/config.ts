import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
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
  /** `TESSERACT_FFMPEG`: decodes idb's H.264 to JPEG frames; without it the screen asks idb for MJPEG. */
  ffmpeg: string | null;
  /**
   * `TESSERACT_SIMCAP`, else `tesseract-simcap` next to the compiled daemon, else on PATH or in `~/.tesseract/bin`: reads
   * the Simulator framebuffer and encodes clean H.264 (macOS only; without it the screen falls back to idb).
   */
  simcap: string | null;
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

const SIMCAP = "tesseract-simcap";

/** The helper shipped next to the compiled daemon (`dirname(process.execPath)`); null when running from a checkout. */
function bundledSimcap(exists: (path: string) => boolean): string | null {
  if (!import.meta.dir.startsWith("/$bunfs")) return null;
  const path = join(dirname(process.execPath), SIMCAP);
  return exists(path) ? path : null;
}

function simcapPath(source: Env, darwin: boolean, path: string, home: string, exists: (path: string) => boolean): string | null {
  if (!darwin) return null;
  if (source.TESSERACT_SIMCAP) return executable(source.TESSERACT_SIMCAP, SIMCAP, path, exists);
  return bundledSimcap(exists) ?? Bun.which(SIMCAP, { PATH: [path, join(home, ".tesseract", "bin")].join(":") });
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
    ffmpeg: executable(source.TESSERACT_FFMPEG, "ffmpeg", path, exists),
    simcap: simcapPath(source, darwin, path, home, exists),
    env: toolEnv(source, path),
  };
}
