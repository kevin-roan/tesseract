import type { HostShellState } from "../../../shared/contracts/hostShell";
import type { MasterHostState } from "../../../shared/contracts/masterHost";
import type { Tone } from "../../theme/colors";
import { PAIR_TARGETS, type PairTarget } from "./constants";
import { PAIR_COMMANDS, PAIR_LABELS } from "./labels";

export interface PairNotice {
  id: string;
  message: string;
  tone: Tone;
  actionLabel?: string;
  onAction?: () => void;
}

export interface PairStep {
  id: string;
  text: string;
  command?: string;
  input?: boolean;
}

export interface PairLinkInput {
  label: string;
  placeholder: string;
  submitLabel: string;
}

export interface PairPanelModel {
  link: string | null;
  caption: string;
  notices: PairNotice[];
  steps: PairStep[];
  linkInput: PairLinkInput | null;
}

export type SandboxPairing =
  | { kind: "unconfigured" }
  | { kind: "invalid"; error: string }
  | { kind: "ready"; link: string; url: string; name?: string | null; online: boolean };

export type HostPairingState = Pick<HostShellState, "status" | "pairing" | "error">;

export interface PairActions {
  openPreferences(): void;
  startHost(): void;
  retryHost(): void;
  setPin?: () => void;
}

export interface MasterActions {
  openPreferences(): void;
  unlinkMaster(): void;
}

const NO_STEPS: PairStep[] = [];

function panel(link: string | null, caption: string, notices: PairNotice[], steps = NO_STEPS, linkInput: PairLinkInput | null = null): PairPanelModel {
  return { link, caption, notices, steps, linkInput };
}

function unconfiguredNotice(openPreferences: () => void): PairNotice {
  return { id: "unconfigured", message: PAIR_LABELS.unconfigured, tone: "warning", actionLabel: PAIR_LABELS.setUp, onAction: openPreferences };
}

export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export function sandboxPanel(input: SandboxPairing, actions: Pick<PairActions, "openPreferences">): PairPanelModel {
  if (input.kind === "unconfigured") return panel(null, "", [unconfiguredNotice(actions.openPreferences)]);
  if (input.kind === "invalid") {
    return panel(null, "", [{ id: "invalid", message: fill(PAIR_LABELS.invalid, { error: input.error }), tone: "danger" }]);
  }
  const caption = input.name ? fill(PAIR_LABELS.sandbox, { name: input.name, url: input.url }) : input.url;
  const notices: PairNotice[] = input.online ? [] : [{ id: "offline", message: PAIR_LABELS.offline, tone: "warning" }];
  return panel(input.link, caption, notices);
}

function statusNotice(state: HostPairingState, actions: PairActions): PairNotice | null {
  switch (state.status) {
    case "failed":
      return {
        id: "failed",
        message: fill(PAIR_LABELS.hostFailed, { error: state.error ?? "" }),
        tone: "danger",
        actionLabel: PAIR_LABELS.retry,
        onAction: actions.retryHost,
      };
    case "stopped":
      return { id: "stopped", message: PAIR_LABELS.hostStopped, tone: "warning", actionLabel: PAIR_LABELS.start, onAction: actions.startHost };
    case "starting":
      return { id: "starting", message: PAIR_LABELS.hostStarting, tone: "neutral" };
    case "external":
      return { id: "external", message: PAIR_LABELS.hostExternal, tone: "neutral" };
    default:
      return null;
  }
}

function pairingNotice(state: HostPairingState, actions: PairActions): PairNotice | null {
  if (state.pairing === null) {
    return state.status === "failed" ? null : { id: "loading", message: PAIR_LABELS.hostLoading, tone: "neutral" };
  }
  if (state.pairing.pinSet) return null;
  return {
    id: "no-pin",
    message: PAIR_LABELS.hostNoPin,
    tone: "warning",
    ...(actions.setPin ? { actionLabel: PAIR_LABELS.setPin, onAction: actions.setPin } : {}),
  };
}

export const HOST_STEPS: PairStep[] = [
  { id: "start", text: PAIR_LABELS.stepStartHost },
  { id: "autostart", text: PAIR_LABELS.stepAutostartHost },
];

export const MASTER_START_STEPS: PairStep[] = [
  { id: "service", text: PAIR_LABELS.stepStartRemote, command: PAIR_COMMANDS.install },
  { id: "check", text: PAIR_LABELS.stepCheck, command: PAIR_COMMANDS.status },
];

export const MASTER_LINK_STEPS: PairStep[] = [
  { id: "install", text: PAIR_LABELS.stepInstallMaster, command: PAIR_COMMANDS.install },
  { id: "pair", text: PAIR_LABELS.stepPrintLinks, command: PAIR_COMMANDS.pair },
  { id: "paste", text: PAIR_LABELS.stepPasteLink, input: true },
];

export const MASTER_LINK_INPUT: PairLinkInput = {
  label: PAIR_LABELS.linkFieldLabel,
  placeholder: PAIR_LABELS.linkPlaceholder,
  submitLabel: PAIR_LABELS.link,
};

export function hostPanel(state: HostPairingState | null, actions: PairActions): PairPanelModel {
  if (state === null) return panel(null, "", [{ id: "loading", message: PAIR_LABELS.hostLoading, tone: "neutral" }]);
  const notices = [statusNotice(state, actions), pairingNotice(state, actions)].filter((notice): notice is PairNotice => notice !== null);
  const pairing = state.pairing;
  const down = state.status === "stopped" || state.status === "failed";
  return panel(
    pairing?.link ?? null,
    pairing ? fill(PAIR_LABELS.hostCaption, { name: pairing.name, url: pairing.url }) : "",
    notices,
    down ? HOST_STEPS : NO_STEPS,
  );
}

export function masterPanel(state: MasterHostState | null, actions: MasterActions): PairPanelModel {
  if (state === null) return panel(null, "", [{ id: "loading", message: PAIR_LABELS.masterLoading, tone: "neutral" }]);
  switch (state.kind) {
    case "none":
      return panel(null, "", [unconfiguredNotice(actions.openPreferences)]);
    case "local":
      return panel(null, "", [{ id: "local", message: PAIR_LABELS.masterLocal, tone: "neutral" }]);
    case "unlinked":
      return panel(
        null,
        "",
        [{ id: "unlinked", message: fill(PAIR_LABELS.masterUnlinked, { url: state.sandboxUrl }), tone: "neutral" }],
        MASTER_LINK_STEPS,
        MASTER_LINK_INPUT,
      );
    case "linked": {
      const { host } = state;
      const caption = host.name ? fill(PAIR_LABELS.masterCaption, { name: host.name, url: host.url }) : host.url;
      if (host.online) return panel(host.link, caption, []);
      const offline: PairNotice = {
        id: "offline",
        message: PAIR_LABELS.masterOffline,
        tone: "warning",
        actionLabel: PAIR_LABELS.unlink,
        onAction: actions.unlinkMaster,
      };
      return panel(host.link, caption, [offline], MASTER_START_STEPS);
    }
  }
}

export function pairTargets(master: MasterHostState | null | undefined): PairTarget[] {
  return PAIR_TARGETS.map((option) => option.id).filter((id) => id !== "master" || (master !== undefined && master?.kind !== "local"));
}

export function visibleTarget(target: PairTarget, targets: readonly PairTarget[]): PairTarget {
  if (targets.includes(target)) return target;
  return target === "master" ? "host" : "sandbox";
}
