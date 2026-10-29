import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { HostToolchain, HostToolchainCandidate, HostToolchainSource, UpdateHostToolchain } from "@tesseract/protocol";
import { badRequest, conflict } from "../core/errors";
import type { Env } from "../core/exec";
import type { Logger } from "../core/logger";
import { loadAndroidConfig, type AndroidConfig } from "./android/config";
import { hostStateDir, hostToolPath } from "./config";
import { HostStateStore, type ToolchainSettings } from "./state";

type Candidate = { path: string; label: string };
type Resolved = { path: string | null; source: HostToolchainSource | null };

export type ResolvedToolchain = { android: Resolved; java: Resolved };

const ADB = join("platform-tools", "adb");
const JAVA = join("bin", "java");
const SDK_ENV = ["TESSERACT_ANDROID_SDK_ROOT", "ANDROID_HOME", "ANDROID_SDK_ROOT"] as const;
/** Folders added in front of PATH so `adb`, `emulator`, `sdkmanager` and `java` resolve in host terminals. */
const SDK_BIN_DIRS = ["platform-tools", "emulator", join("cmdline-tools", "latest", "bin")];

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

const usableSdk = (path: string) => existsSync(join(path, ADB));
const usableJava = (path: string) => existsSync(join(path, JAVA));

function listDirs(parent: string, suffix: string[] = []): string[] {
  try {
    return readdirSync(parent)
      .sort()
      .reverse()
      .map((name) => join(parent, name, ...suffix))
      .filter(isDir);
  } catch {
    return [];
  }
}

function sdkSuggestions(home: string, platform: NodeJS.Platform): Candidate[] {
  if (platform === "darwin") {
    const support = join(home, "Library", "Application Support");
    return [
      { path: join(support, "Tesseract", "android-sdk"), label: "Tesseract" },
      { path: join(home, "Library", "Android", "sdk"), label: "Android Studio" },
      { path: "/opt/homebrew/share/android-commandlinetools", label: "Homebrew" },
      { path: "/usr/local/share/android-commandlinetools", label: "Homebrew" },
    ];
  }
  return [
    { path: join(home, ".local", "share", "tesseract", "android-sdk"), label: "Tesseract" },
    { path: join(home, "Android", "Sdk"), label: "Android Studio" },
    { path: "/opt/android-sdk", label: "System" },
  ];
}

/** Android Studio's bundled JDK first (what Gradle builds are tested with), then installed JDKs, newest name first. */
function javaSuggestions(home: string, platform: NodeJS.Platform): Candidate[] {
  if (platform === "darwin") {
    const studio = (apps: string) => ({ path: join(apps, "Android Studio.app", "Contents", "jbr", "Contents", "Home"), label: "Android Studio" });
    return [
      studio("/Applications"),
      studio(join(home, "Applications")),
      ...["/opt/homebrew", "/usr/local"].map((prefix) => ({ path: join(prefix, "opt", "openjdk@17", "libexec", "openjdk.jdk", "Contents", "Home"), label: "Homebrew" })),
      ...listDirs("/Library/Java/JavaVirtualMachines", ["Contents", "Home"]).map((path) => ({ path, label: "Installed JDK" })),
    ];
  }
  return [
    { path: "/opt/android-studio/jbr", label: "Android Studio" },
    { path: join(home, "android-studio", "jbr"), label: "Android Studio" },
    { path: "/opt/java/openjdk", label: "System" },
    ...listDirs("/usr/lib/jvm").map((path) => ({ path, label: "Installed JDK" })),
  ];
}

function envCandidates(env: Env, names: readonly string[]): Candidate[] {
  return names.flatMap((name) => (env[name] ? [{ path: env[name], label: name }] : []));
}

/** Existing folders only, each once (the first label wins). */
function dedupe(candidates: Candidate[], usable: (path: string) => boolean): HostToolchainCandidate[] {
  const seen = new Set<string>();
  const result: HostToolchainCandidate[] = [];
  for (const { path, label } of candidates) {
    if (seen.has(path) || !isDir(path)) continue;
    seen.add(path);
    result.push({ path, label, usable: usable(path) });
  }
  return result;
}

export function sdkCandidates(env: Env, platform: NodeJS.Platform = process.platform): HostToolchainCandidate[] {
  return dedupe([...envCandidates(env, SDK_ENV), ...sdkSuggestions(env.HOME || homedir(), platform)], usableSdk);
}

export function javaCandidates(env: Env, platform: NodeJS.Platform = process.platform): HostToolchainCandidate[] {
  return dedupe([...envCandidates(env, ["JAVA_HOME"]), ...javaSuggestions(env.HOME || homedir(), platform)], usableJava);
}

function pick(configured: string | undefined, fromEnv: string | undefined, candidates: HostToolchainCandidate[]): Resolved {
  if (configured) return { path: configured, source: "settings" };
  if (fromEnv) return { path: fromEnv, source: "env" };
  const found = candidates.find((candidate) => candidate.usable);
  return found ? { path: found.path, source: "detected" } : { path: null, source: null };
}

/** Saved settings win, then the environment the daemon started with, then the first usable folder found. */
export function resolveToolchain(settings: ToolchainSettings, env: Env, platform: NodeJS.Platform = process.platform): ResolvedToolchain {
  const sdkEnv = SDK_ENV.map((name) => env[name]).find(Boolean);
  return {
    android: pick(settings.androidSdkRoot, sdkEnv, sdkCandidates(env, platform)),
    java: pick(settings.javaHome, env.JAVA_HOME, javaCandidates(env, platform)),
  };
}

/** What host terminals and Claude Code on the host get, so `npm run android` and Gradle find the SDK and the JDK. */
export function toolchainEnv(resolved: ResolvedToolchain, env: Env, platform: NodeJS.Platform = process.platform): Env {
  const result: Env = {};
  const front: string[] = [];
  const sdk = resolved.android.path;
  const java = resolved.java.path;
  if (java) {
    result.JAVA_HOME = java;
    front.push(join(java, "bin"));
  }
  if (sdk) {
    result.ANDROID_HOME = sdk;
    result.ANDROID_SDK_ROOT = sdk;
    front.push(...SDK_BIN_DIRS.map((dir) => join(sdk, dir)).filter(isDir));
  }
  const rest = hostToolPath(env, platform)
    .split(":")
    .filter((dir) => dir && !front.includes(dir));
  result.PATH = [...front, ...rest].join(":");
  return result;
}

/** The daemon environment the emulator config is loaded from, pointing at the SDK chosen in settings. */
export function androidSourceEnv(env: Env, settings: ToolchainSettings): Env {
  const sdk = settings.androidSdkRoot;
  if (!sdk) return env;
  const adb = join(sdk, ADB);
  const { TESSERACT_ADB: _adb, ...rest } = env;
  return { ...rest, TESSERACT_ANDROID_SDK_ROOT: sdk, ...(existsSync(adb) ? { TESSERACT_ADB: adb } : {}) };
}

/** For `host workspace serve`: reads the host shell's saved settings, if any. */
export function savedToolchainEnv(env: Env, platform: NodeJS.Platform = process.platform): Env {
  let settings: ToolchainSettings = {};
  try {
    const dir = hostStateDir(env);
    settings = new HostStateStore(dir, join(dir, "state.json")).toolchain();
  } catch {}
  return toolchainEnv(resolveToolchain(settings, env, platform), env, platform);
}

export type HostToolchainOptions = {
  env?: Env;
  platform?: NodeJS.Platform;
  /** True while the daemon's emulator runs; the SDK must not change under it. */
  emulatorActive?: () => boolean;
};

/** `/v1/android/toolchain`: the SDK and JDK of this host, editable from a connected desktop app. */
export class HostToolchainSettings {
  private readonly env: Env;
  private readonly platform: NodeJS.Platform;

  constructor(
    private readonly android: AndroidConfig,
    private readonly store: HostStateStore,
    private readonly logger: Logger,
    private readonly options: HostToolchainOptions = {},
  ) {
    this.env = options.env ?? process.env;
    this.platform = options.platform ?? process.platform;
  }

  /** Points the emulator at a saved SDK; without one the config from the environment stays as it is. */
  init(): void {
    if (this.store.toolchain().androidSdkRoot) this.reloadAndroid();
  }

  status(): HostToolchain {
    const settings = this.store.toolchain();
    const resolved = resolveToolchain(settings, this.env, this.platform);
    return {
      platform: this.platform,
      android: {
        configured: settings.androidSdkRoot ?? null,
        ...resolved.android,
        adb: this.android.adb,
        emulator: this.android.emulator,
        candidates: sdkCandidates(this.env, this.platform),
      },
      java: { configured: settings.javaHome ?? null, ...resolved.java, candidates: javaCandidates(this.env, this.platform) },
    };
  }

  update(change: UpdateHostToolchain): HostToolchain {
    for (const path of [change.androidSdkRoot, change.javaHome]) {
      if (path && !isDir(path)) throw badRequest(`Folder ${path.slice(0, 200)} not found on this host`);
    }
    const before = this.store.toolchain();
    const sdkChanges = change.androidSdkRoot !== undefined && (change.androidSdkRoot ?? undefined) !== before.androidSdkRoot;
    if (sdkChanges && this.options.emulatorActive?.()) throw conflict("Stop the emulator before changing the Android SDK");
    this.store.updateToolchain(change);
    if (sdkChanges) this.reloadAndroid();
    this.logger.info("toolchain updated", { ...this.store.toolchain() });
    return this.status();
  }

  /** New host terminals start with this on top of the daemon's environment. */
  terminalEnv(): Env {
    return toolchainEnv(resolveToolchain(this.store.toolchain(), this.env, this.platform), this.env, this.platform);
  }

  /** Components hold this config object, so it is updated in place. */
  private reloadAndroid(): void {
    Object.assign(this.android, loadAndroidConfig(androidSourceEnv(this.env, this.store.toolchain()), this.platform));
  }
}
