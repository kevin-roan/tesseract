import type { Tone } from "../../../shared/contracts/common";
import { BANNERLESS_STATUSES, CONNECTION_TONES, EVENTS_TONES } from "./constants";
import { BANNER_LABELS, CONNECTION_LABELS, CONNECTION_STATUS_LABELS, EVENTS_STATUS_LABELS, SOURCE_LABELS } from "./labels";
import type { BannerAction, ConnectionState, ConnectionStatus } from "./types";

export interface ConnectionBanner {
  status: ConnectionStatus;
  title: string;
  tone: Tone;
  action: BannerAction | null;
  actionLabel: string | null;
}

export interface ConnectionView {
  status: ConnectionStatus;
  online: boolean;
  label: string;
  tone: Tone;
  sandboxName: string | null;
  title: string;
  subtitle: string;
  detail: string;
  dotTone: Tone;
  tooltip: string;
  eventsLabel: string;
  eventsTone: Tone;
  sourceLabel: string | null;
  configFileLabel: string | null;
  banner: ConnectionBanner | null;
}

export function sandboxName(state: Pick<ConnectionState, "health" | "config">): string | null {
  return state.health?.sandboxId || state.config?.name || null;
}

export function statusTitle(state: Pick<ConnectionState, "status" | "health" | "config">): string {
  const label = CONNECTION_STATUS_LABELS[state.status];
  const name = sandboxName(state);
  return name ? `${name}${CONNECTION_LABELS.separator}${label}` : label;
}

export function connectionBanner(state: Pick<ConnectionState, "status" | "errorMessage">): ConnectionBanner | null {
  const { status } = state;
  if (BANNERLESS_STATUSES.includes(status)) return null;
  const tone = CONNECTION_TONES[status];
  const error = state.errorMessage ?? "";
  switch (status) {
    case "unconfigured":
      return { status, tone, title: BANNER_LABELS.unconfigured, action: "setup", actionLabel: BANNER_LABELS.setUp };
    case "discovering":
      return { status, tone, title: BANNER_LABELS.discovering, action: null, actionLabel: null };
    case "offline":
      return { status, tone, title: BANNER_LABELS.offline(error), action: "retry", actionLabel: BANNER_LABELS.retry };
    case "unauthorized":
      return { status, tone, title: BANNER_LABELS.unauthorized, action: "preferences", actionLabel: BANNER_LABELS.fixConnection };
    default:
      return { status, tone, title: error, action: "preferences", actionLabel: BANNER_LABELS.details };
  }
}

export function connectionView(state: ConnectionState): ConnectionView {
  const name = sandboxName(state);
  const online = state.status === "online";
  const label = CONNECTION_STATUS_LABELS[state.status];
  const tone = CONNECTION_TONES[state.status];
  const eventsLabel = EVENTS_STATUS_LABELS[state.events];
  const eventsTone = EVENTS_TONES[state.events];
  return {
    status: state.status,
    online,
    label,
    tone,
    sandboxName: name,
    title: name ?? CONNECTION_LABELS.sandbox,
    subtitle: state.errorMessage || name || "",
    detail: online ? `${label}${CONNECTION_LABELS.separator}${eventsLabel}` : label,
    dotTone: online ? eventsTone : tone,
    tooltip: state.errorMessage || CONNECTION_LABELS.connectionSettings,
    eventsLabel,
    eventsTone,
    sourceLabel: state.config ? SOURCE_LABELS[state.config.source] : null,
    configFileLabel: state.configFile ? CONNECTION_LABELS.configFile(state.configFile) : null,
    banner: connectionBanner(state),
  };
}
