import type { AndroidLinkInfo, HostAndroidStatus } from "@theone/protocol";
import type { HostShellState } from "../../../../../shared/contracts/hostShell";
import { EMULATOR_LABELS } from "./labels";

export { androidTarget, displayButton, hostFixable, liveRun } from "../../../../features/projects/emulator";
export type { DisplayButtonModel as DisplayButton } from "../../../../features/projects/types";

export type EmulatorStage = keyof typeof EMULATOR_LABELS.progress;

export interface EmulatorPlan {
  stop: boolean;
  avd: string | null;
  link: boolean;
  replaces: string | null;
  blocked: string | null;
}

const PLAN: EmulatorPlan = { stop: false, avd: null, link: false, replaces: null, blocked: null };

export function hostBlocker(state: HostShellState | null): string | null {
  if (state === null) return EMULATOR_LABELS.hostLoading;
  if (state.status === "stopped" || state.status === "stopping" || state.status === "failed") return EMULATOR_LABELS.hostStopped;
  if (state.status === "starting" || state.pairing === null) return EMULATOR_LABELS.hostLoading;
  if (!state.pairing.pinSet) return EMULATOR_LABELS.hostNoPin;
  return null;
}

export function hostUnlocked(state: HostShellState | null, now = Date.now()): boolean {
  return state?.sessionExpiresAt !== null && state?.sessionExpiresAt !== undefined && state.sessionExpiresAt > now;
}

const trimUrl = (url: string) => url.trim().replace(/\/+$/, "").toLowerCase();

export function isLinkedTo(link: AndroidLinkInfo, sandboxUrl: string): boolean {
  return link.configured && link.sandboxUrl !== null && trimUrl(link.sandboxUrl) === trimUrl(sandboxUrl);
}

export function pickAvd(status: HostAndroidStatus): string | null {
  const current = status.emulator.avd;
  if (current && status.avds.includes(current)) return current;
  return status.avds[0] ?? null;
}

export function planEmulator(status: HostAndroidStatus, sandboxUrl: string): EmulatorPlan {
  if (!status.available || status.emulator.state === "unavailable") {
    return { ...PLAN, blocked: status.reason || EMULATOR_LABELS.hostUnavailable };
  }
  if (status.isolation === "none") return { ...PLAN, blocked: EMULATOR_LABELS.isolationOff };
  const { emulator, link } = status;
  if (emulator.state === "stopping") return { ...PLAN, blocked: EMULATOR_LABELS.stopping };
  const linked = isLinkedTo(link, sandboxUrl);
  const relink = !(linked && link.connected);
  const replaces = link.configured && link.connected && !linked ? link.sandboxUrl : null;
  const active = emulator.state === "starting" || emulator.state === "running";
  if (active && emulator.isolated) return { ...PLAN, link: relink, replaces };
  const avd = pickAvd(status);
  if (avd === null) return { ...PLAN, blocked: EMULATOR_LABELS.noAvd };
  return { ...PLAN, stop: active, avd, link: relink, replaces };
}

export function emulatorReady(status: HostAndroidStatus, sandboxUrl: string): boolean {
  const { emulator, link } = status;
  return emulator.state === "running" && emulator.isolated && isLinkedTo(link, sandboxUrl) && link.connected;
}

export type ConfirmStep = { kind: "restart"; avd: string } | { kind: "relink"; url: string };

export function confirmSteps(plan: EmulatorPlan): ConfirmStep[] {
  const steps: ConfirmStep[] = [];
  if (plan.stop) steps.push({ kind: "restart", avd: plan.avd ?? "" });
  if (plan.replaces) steps.push({ kind: "relink", url: plan.replaces });
  return steps;
}
