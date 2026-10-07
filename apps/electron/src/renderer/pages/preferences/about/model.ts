import type { CliInstallStatus } from "../../../../shared/contracts/app";
import type { UpdateState } from "../../../../shared/contracts/updates";
import { formatBytes } from "../../../onboarding/android/model";
import { HOURS_PER_DAY, MINUTE_MS, MINUTES_PER_HOUR, PERCENT } from "./constants";
import { ABOUT_LABELS } from "./labels";

const U = ABOUT_LABELS.updates;
const C = ABOUT_LABELS.cli;

export type UpdateAction = "check" | "download" | "install" | null;

export interface UpdateView {
  subtitle: string;
  action: UpdateAction;
  actionLabel: string | null;
  primary: boolean;
  busy: boolean;
  progress: number | null | undefined;
  notes: string | null;
}

export function formatRelative(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return iso;
  const minutes = Math.floor((now - then) / MINUTE_MS);
  const R = ABOUT_LABELS.relative;
  if (minutes < 1) return R.now;
  if (minutes < MINUTES_PER_HOUR) return R.minutes(minutes);
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return R.hours(hours);
  return R.days(Math.floor(hours / HOURS_PER_DAY));
}

function transfer(received: number, total: number | null): string {
  if (!total) return formatBytes(received);
  return `${formatBytes(received)} of ${formatBytes(total)} · ${Math.round((received / total) * PERCENT)}%`;
}

const NONE: Omit<UpdateView, "subtitle"> = { action: null, actionLabel: null, primary: false, busy: false, progress: undefined, notes: null };

export function updateView(state: UpdateState | null, now: number): UpdateView {
  if (!state) return { ...NONE, subtitle: U.checking, busy: true };
  switch (state.kind) {
    case "idle":
      return { ...NONE, subtitle: state.checkedAt ? U.checkedAt(formatRelative(state.checkedAt, now)) : U.notChecked, action: "check", actionLabel: U.check };
    case "unsupported":
      return { ...NONE, subtitle: state.reason };
    case "checking":
      return { ...NONE, subtitle: U.checking, action: "check", actionLabel: U.check, busy: true };
    case "up-to-date":
      return { ...NONE, subtitle: U.upToDate(formatRelative(state.checkedAt, now)), action: "check", actionLabel: U.checkAgain };
    case "available":
      return { ...NONE, subtitle: U.available(state.version), action: "download", actionLabel: U.download, primary: true, notes: state.notes };
    case "downloading": {
      const { received, total } = state.progress;
      return { ...NONE, subtitle: U.downloading(state.version, transfer(received, total)), progress: total ? received / total : null };
    }
    case "ready":
      return { ...NONE, subtitle: U.ready(state.version), action: "install", actionLabel: U.restart, primary: true };
    case "error":
      return { ...NONE, subtitle: U.error(state.message), action: "check", actionLabel: U.retry };
  }
}

export interface CliView {
  subtitle: string;
  installed: boolean;
  canInstall: boolean;
}

export function cliView(status: CliInstallStatus | null): CliView {
  if (!status) return { subtitle: "", installed: false, canInstall: false };
  switch (status.state) {
    case "installed":
      return { subtitle: C.installed(status.linkPath ?? status.binaryPath ?? ""), installed: true, canInstall: false };
    case "missing":
      return { subtitle: status.message ?? C.missing, installed: false, canInstall: true };
    case "conflict":
      return { subtitle: status.message ?? C.conflict(status.linkPath ?? ""), installed: false, canInstall: true };
    case "unsupported":
      return { subtitle: status.message ?? C.unsupported, installed: false, canInstall: false };
  }
}
