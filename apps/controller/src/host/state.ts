import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import {
  DEFAULT_ANDROID_STREAM,
  DEFAULT_IOS_STREAM,
  LIMITS,
  SHA256_PATTERN,
  UpdateAndroidStreamSchema,
  UpdateIosStreamSchema,
  type AndroidStreamSettings,
  type IosStreamSettings,
  type UpdateAndroidStream,
  type UpdateIosStream,
} from "@tesseract/protocol";
import { generateToken } from "../auth/token";

export type AndroidLinkConfig = { sandboxUrl: string; token: string };

export type HostState = {
  token: string | null;
  pinHash: string | null;
  pinSetAt: string | null;
  failures: number;
  lockedUntil: string | null;
  lockouts: number;
  androidLink: AndroidLinkConfig | null;
  /** Only the stream settings changed from `DEFAULT_ANDROID_STREAM`. */
  androidStream: UpdateAndroidStream;
  iosLink: AndroidLinkConfig | null;
  /** sha256 of sandbox simulator builds the user approved for install (newest last). */
  iosApprovedBundles: string[];
  /** Only the iOS screen stream settings changed from `DEFAULT_IOS_STREAM`. */
  iosStream: UpdateIosStream;
  /** Android SDK and JDK folders chosen in the desktop app's settings; absent fields are detected. */
  toolchain: ToolchainSettings;
};

export type ToolchainSettings = { androidSdkRoot?: string; javaHome?: string };

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

const EMPTY: HostState = { token: null, pinHash: null, pinSetAt: null, failures: 0, lockedUntil: null, lockouts: 0, androidLink: null, androidStream: {}, iosLink: null, iosApprovedBundles: [], iosStream: {}, toolchain: {} };

const text = (value: unknown) => (typeof value === "string" && value ? value : null);
function androidLink(value: unknown): AndroidLinkConfig | null {
  if (typeof value !== "object" || value === null) return null;
  const sandboxUrl = text((value as Record<string, unknown>).sandboxUrl);
  const token = text((value as Record<string, unknown>).token);
  return sandboxUrl && token ? { sandboxUrl, token } : null;
}
/** Keeps each valid field; an invalid one falls back to its default. */
function streamFields<T>(schema: typeof UpdateAndroidStreamSchema | typeof UpdateIosStreamSchema, value: unknown): T {
  if (typeof value !== "object" || value === null) return {} as T;
  const kept: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    const parsed = schema.safeParse({ [key]: field });
    if (parsed.success && key in parsed.data) kept[key] = field;
  }
  return kept as T;
}
function toolchain(value: unknown): ToolchainSettings {
  if (typeof value !== "object" || value === null) return {};
  const record = value as Record<string, unknown>;
  const settings: ToolchainSettings = {};
  const sdk = text(record.androidSdkRoot);
  const java = text(record.javaHome);
  if (sdk) settings.androidSdkRoot = sdk;
  if (java) settings.javaHome = java;
  return settings;
}
const androidStream = (value: unknown) => streamFields<UpdateAndroidStream>(UpdateAndroidStreamSchema, value);
const iosStream = (value: unknown) => streamFields<UpdateIosStream>(UpdateIosStreamSchema, value);
const hashes = (value: unknown) => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && SHA256_PATTERN.test(entry)) : []);
const count = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0);

/** state.json (0600) in a 0700 directory; every change rewrites it atomically. */
export class HostStateStore {
  constructor(
    readonly dir: string,
    readonly file: string,
  ) {}

  read(): HostState {
    let raw: string;
    try {
      raw = readFileSync(this.file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ...EMPTY };
      throw error;
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      token: text(parsed.token),
      pinHash: text(parsed.pinHash),
      pinSetAt: text(parsed.pinSetAt),
      failures: count(parsed.failures),
      lockedUntil: text(parsed.lockedUntil),
      lockouts: count(parsed.lockouts),
      androidLink: androidLink(parsed.androidLink),
      androidStream: androidStream(parsed.androidStream),
      iosLink: androidLink(parsed.iosLink),
      iosApprovedBundles: hashes(parsed.iosApprovedBundles),
      iosStream: iosStream(parsed.iosStream),
      toolchain: toolchain(parsed.toolchain),
    };
  }

  write(state: HostState): void {
    mkdirSync(this.dir, { recursive: true, mode: DIR_MODE });
    chmodSync(this.dir, DIR_MODE);
    const temp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, { mode: FILE_MODE });
    chmodSync(temp, FILE_MODE);
    renameSync(temp, this.file);
  }

  update(change: (state: HostState) => HostState): HostState {
    const next = change(this.read());
    this.write(next);
    return next;
  }

  ensureToken(): string {
    const state = this.read();
    if (state.token) return state.token;
    return this.update((current) => ({ ...current, token: generateToken() })).token ?? "";
  }

  rotateToken(): string {
    return this.update((current) => ({ ...current, token: generateToken() })).token ?? "";
  }

  setAndroidLink(link: AndroidLinkConfig | null): void {
    this.update((current) => ({ ...current, androidLink: link }));
  }

  setIosLink(link: AndroidLinkConfig | null): void {
    this.update((current) => ({ ...current, iosLink: link }));
  }

  approveIosBundle(sha256: string): void {
    this.update((current) => ({
      ...current,
      iosApprovedBundles: [...current.iosApprovedBundles.filter((entry) => entry !== sha256), sha256].slice(-LIMITS.maxIosApprovedBundles),
    }));
  }

  androidStreamSettings(): AndroidStreamSettings {
    return { ...DEFAULT_ANDROID_STREAM, ...this.read().androidStream };
  }

  updateAndroidStream(change: UpdateAndroidStream): AndroidStreamSettings {
    const next = this.update((current) => ({ ...current, androidStream: { ...current.androidStream, ...change } }));
    return { ...DEFAULT_ANDROID_STREAM, ...next.androidStream };
  }

  iosStreamSettings(): IosStreamSettings {
    return { ...DEFAULT_IOS_STREAM, ...this.read().iosStream };
  }

  updateIosStream(change: UpdateIosStream): IosStreamSettings {
    const next = this.update((current) => ({ ...current, iosStream: { ...current.iosStream, ...change } }));
    return { ...DEFAULT_IOS_STREAM, ...next.iosStream };
  }

  toolchain(): ToolchainSettings {
    return this.read().toolchain;
  }

  /** null clears a field (back to detection); undefined leaves it. */
  updateToolchain(change: { androidSdkRoot?: string | null; javaHome?: string | null }): ToolchainSettings {
    return this.update((current) => {
      const next: ToolchainSettings = { ...current.toolchain };
      for (const key of ["androidSdkRoot", "javaHome"] as const) {
        const value = change[key];
        if (value === null) delete next[key];
        else if (value !== undefined) next[key] = value;
      }
      return { ...current, toolchain: next };
    }).toolchain;
  }

  async setPin(pin: string, now: Date = new Date()): Promise<void> {
    const pinHash = await Bun.password.hash(pin, { algorithm: "argon2id" });
    this.update((current) => ({
      ...current,
      token: current.token ?? generateToken(),
      pinHash,
      pinSetAt: now.toISOString(),
      failures: 0,
      lockedUntil: null,
      lockouts: 0,
    }));
  }
}
