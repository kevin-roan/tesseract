import type { HostInfo, OnboardingState, StepStatus } from "../../shared/contracts/onboarding";
import type { SetupChoices } from "../../shared/contracts/sandbox";
import { readFile, statfs } from "node:fs/promises";
import { cpus, homedir, release, totalmem } from "node:os";
import { ONBOARDING_STEP_IDS, type OnboardingStepId } from "../../shared/routes";
import { initialConnection, type ConfigData } from "../config";

export const ONBOARDING_KEY = "onboarding";
export const ONBOARDING_VERSION = 1;
const OS_RELEASE_FILES = ["/etc/os-release", "/usr/lib/os-release"];

export interface PersistedOnboarding {
  version: number;
  step: OnboardingStepId;
  statuses: Partial<Record<OnboardingStepId, StepStatus>>;
  completedAt: string | null;
}

export function persistedOnboarding(data: ConfigData): PersistedOnboarding | null {
  const value = data[ONBOARDING_KEY];
  if (typeof value !== "object" || value === null) return null;
  const record = value as Partial<PersistedOnboarding>;
  const step = ONBOARDING_STEP_IDS.find((id) => id === record.step) ?? "welcome";
  return {
    version: typeof record.version === "number" ? record.version : ONBOARDING_VERSION,
    step,
    statuses: typeof record.statuses === "object" && record.statuses !== null ? record.statuses : {},
    completedAt: typeof record.completedAt === "string" ? record.completedAt : null,
  };
}

export type FirstRunDecision =
  | { open: false; reason: "completed" | "configured" | "discovered" }
  | { open: true; step: OnboardingStepId };

export function decideFirstRun(
  data: ConfigData,
  env: Record<string, string | undefined>,
  discovered = false,
): FirstRunDecision {
  const saved = persistedOnboarding(data);
  if (saved?.completedAt) return { open: false, reason: "completed" };
  if (initialConnection(data, env)) return { open: false, reason: "configured" };
  if (discovered) return { open: false, reason: "discovered" };
  return { open: true, step: saved?.step ?? "welcome" };
}

export function initialStatuses(step: OnboardingStepId): Record<OnboardingStepId, StepStatus> {
  return Object.fromEntries(
    ONBOARDING_STEP_IDS.map((id) => [id, id === step ? "active" : "pending"]),
  ) as Record<OnboardingStepId, StepStatus>;
}

export function initialOnboardingState(host: HostInfo, choices: SetupChoices, step: OnboardingStepId = "welcome"): OnboardingState {
  return {
    step,
    statuses: initialStatuses(step),
    host,
    docker: null,
    dockerPhase: { kind: "idle" },
    claude: null,
    choices,
    build: { kind: "idle" },
    android: { kind: "idle" },
    androidSupport: null,
    pair: null,
    log: { docker: [], build: [], android: [] },
    completedAt: null,
  };
}

export function parseOsRelease(text: string): NonNullable<HostInfo["distro"]> {
  const values = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (match?.[1]) values.set(match[1], (match[2] ?? "").replace(/^["']|["']$/g, ""));
  }
  return {
    id: values.get("ID") ?? "",
    idLike: (values.get("ID_LIKE") ?? "").split(/\s+/).filter(Boolean),
    versionId: values.get("VERSION_ID") ?? "",
    prettyName: values.get("PRETTY_NAME") ?? values.get("NAME") ?? "",
  };
}

async function freeBytes(dir: string): Promise<number | null> {
  try {
    const stats = await statfs(dir);
    return Number(stats.bavail) * Number(stats.bsize);
  } catch {
    return null;
  }
}

async function readDistro(platform: NodeJS.Platform): Promise<HostInfo["distro"]> {
  if (platform !== "linux") return undefined;
  for (const file of OS_RELEASE_FILES) {
    const text = await readFile(file, "utf8").catch(() => null);
    if (text) return parseOsRelease(text);
  }
  return undefined;
}

export interface HostInfoOptions {
  platform?: NodeJS.Platform;
  arch?: string;
  home?: string;
  translated?: boolean;
}

export async function readHostInfo(options: HostInfoOptions = {}): Promise<HostInfo> {
  const platform = options.platform ?? process.platform;
  const home = options.home ?? homedir();
  const arch = options.arch ?? process.arch;
  const distro = await readDistro(platform);
  return {
    platform: platform === "darwin" || platform === "win32" ? platform : "linux",
    arch: arch === "arm64" ? "arm64" : "x64",
    osVersion: release(),
    ...(distro ? { distro } : {}),
    cpus: cpus().length,
    memBytes: totalmem(),
    translated: options.translated ?? false,
    homeDir: home,
    freeDiskBytes: await freeBytes(home),
  };
}
export { canonicalStep, derivedStatus, nextStep, resolveStatuses } from "./statuses";
