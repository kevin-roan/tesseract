export const APP_ID = "dev.monolith.Desktop";
export const APP_NAME = "Monolith";
export const DEEP_LINK_SCHEME = "monolith";
export const CLI_NAME = "monolith";

export const RENDERER_DEV_HOST = "127.0.0.1";
export const RENDERER_DEV_PORT = 4545;

export const ENV = {
  fixtures: "MONOLITH_FIXTURES",
  snapshot: "MONOLITH_SNAPSHOT",
  config: "MONOLITH_DESKTOP_CONFIG",
  stateDir: "MONOLITH_STATE_DIR",
  userData: "MONOLITH_USER_DATA",
  log: "MONOLITH_DESKTOP_LOG",
  rendererUrl: "ELECTRON_RENDERER_URL",
  controllerCommand: "MONOLITH_CONTROLLER_COMMAND",
} as const;

export const RUNTIME_ARG = "--monolith-runtime=";
export const SNAPSHOT_ARG = "--monolith-snapshot=";

export type Platform = "linux" | "darwin" | "win32";
export type Appearance = "system" | "light" | "dark";
export type Scheme = "graphite" | "graphiteLight";
export type WindowKind = "main" | "onboarding" | "snapshot";

export interface RuntimeInfo {
  platform: Platform;
  arch: string;
  version: string;
  windowKind: WindowKind;
  fixtures: boolean;
  snapshot: boolean;
  appearanceOverride: Appearance | null;
  reducedMotion: boolean;
}

export function encodeRuntimeArg(info: RuntimeInfo): string {
  return `${RUNTIME_ARG}${encodeURIComponent(JSON.stringify(info))}`;
}

export function decodeRuntimeArg(argv: readonly string[]): RuntimeInfo | null {
  const arg = argv.find((value) => value.startsWith(RUNTIME_ARG));
  if (!arg) return null;
  try {
    return JSON.parse(decodeURIComponent(arg.slice(RUNTIME_ARG.length))) as RuntimeInfo;
  } catch {
    return null;
  }
}

export interface SnapshotRequest {
  route: string;
  out: string;
  width: number;
  height: number;
  appearance: Appearance;
  timeoutMs: number;
}

export function encodeSnapshotArg(request: SnapshotRequest): string {
  return `${SNAPSHOT_ARG}${encodeURIComponent(JSON.stringify(request))}`;
}

export function decodeSnapshotArg(argv: readonly string[]): SnapshotRequest | null {
  const raw = argv.find((arg) => arg.startsWith(SNAPSHOT_ARG));
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw.slice(SNAPSHOT_ARG.length))) as SnapshotRequest;
  } catch {
    return null;
  }
}
