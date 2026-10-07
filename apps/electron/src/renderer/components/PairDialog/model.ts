import type { HostShellState } from "../../../shared/contracts/hostShell";
import type { Tone } from "../../theme/colors";
import { PAIR_LABELS } from "./labels";

export interface PairNotice {
  id: string;
  message: string;
  tone: Tone;
  actionLabel?: string;
  onAction?: () => void;
}

export interface PairPanelModel {
  link: string | null;
  caption: string;
  notices: PairNotice[];
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

export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export function sandboxPanel(input: SandboxPairing, actions: Pick<PairActions, "openPreferences">): PairPanelModel {
  if (input.kind === "unconfigured") {
    return {
      link: null,
      caption: "",
      notices: [
        {
          id: "unconfigured",
          message: PAIR_LABELS.unconfigured,
          tone: "warning",
          actionLabel: PAIR_LABELS.setUp,
          onAction: actions.openPreferences,
        },
      ],
    };
  }
  if (input.kind === "invalid") {
    return { link: null, caption: "", notices: [{ id: "invalid", message: fill(PAIR_LABELS.invalid, { error: input.error }), tone: "danger" }] };
  }
  const caption = input.name ? fill(PAIR_LABELS.sandbox, { name: input.name, url: input.url }) : input.url;
  const notices: PairNotice[] = input.online ? [] : [{ id: "offline", message: PAIR_LABELS.offline, tone: "warning" }];
  return { link: input.link, caption, notices };
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

export function hostPanel(state: HostPairingState | null, actions: PairActions): PairPanelModel {
  if (state === null) {
    return { link: null, caption: "", notices: [{ id: "loading", message: PAIR_LABELS.hostLoading, tone: "neutral" }] };
  }
  const notices = [statusNotice(state, actions), pairingNotice(state, actions)].filter((notice): notice is PairNotice => notice !== null);
  const pairing = state.pairing;
  return {
    link: pairing?.link ?? null,
    caption: pairing ? fill(PAIR_LABELS.hostCaption, { name: pairing.name, url: pairing.url }) : "",
    notices,
  };
}
