import { BRIDGE_KEY, type TesseractBridge } from "../../shared/ipc";
import { SEARCH_PARAM } from "../../shared/routes";
import { decodeRuntimeArg, type Appearance, type Platform, type RuntimeInfo } from "../../shared/runtime";

const BROWSER_FALLBACK: RuntimeInfo = {
  platform: "linux",
  arch: "x64",
  version: "0.0.0",
  windowKind: "main",
  fixtures: true,
  snapshot: false,
  appearanceOverride: null,
  reducedMotion: false,
};

export function bridge(): TesseractBridge | null {
  return (globalThis as unknown as Record<string, TesseractBridge | undefined>)[BRIDGE_KEY] ?? null;
}

function locationParams(): URLSearchParams {
  const params = new URLSearchParams(globalThis.location?.search ?? "");
  const hash = globalThis.location?.hash ?? "";
  const query = hash.indexOf("?");
  if (query !== -1) new URLSearchParams(hash.slice(query + 1)).forEach((value, key) => params.set(key, value));
  return params;
}

function readRuntime(): RuntimeInfo {
  const fromBridge = bridge() ? decodeRuntimeArg(bridge()?.runtimeArgv ?? []) : null;
  const base = fromBridge ?? BROWSER_FALLBACK;
  const params = locationParams();
  const scheme = params.get(SEARCH_PARAM.scheme);
  const appearanceOverride: Appearance | null =
    scheme === "light" || scheme === "dark" ? scheme : base.appearanceOverride;
  return { ...base, fixtures: base.fixtures || params.has(SEARCH_PARAM.fixtures), appearanceOverride };
}

export const runtime: RuntimeInfo = readRuntime();

export const isFixtureMode = (): boolean => runtime.fixtures;
export const currentPlatform = (): Platform => runtime.platform;
