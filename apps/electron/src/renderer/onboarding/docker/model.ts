import type { DockerActionKey, DockerInstallOption, DockerPhase, DockerReport } from "../../../shared/contracts/docker";
import type { HostInfo, StepStatus } from "../../../shared/contracts/onboarding";
import type { Platform } from "../../../shared/runtime";
import type { CheckRowStatus } from "../shell";
import {
  BUSY_PHASES,
  LICENSED_OPTIONS,
  OPERATION_PHASES,
  PLACEHOLDER_CHECKS,
  PLATFORM_INSTALL_OPTIONS,
  PRIMARY_ACTIONS,
  REQUIRED_CHECKS,
} from "./constants";
import { DOCKER_LABELS } from "./labels";
import { BINARY_BYTE_BASE } from "../shared/constants";
import { formatBytes as formatSize } from "../shared/format";

export type DockerPanel = "none" | "install" | "permission" | "relogin" | "reboot";

export interface CheckView {
  id: string;
  title: string;
  subtitle: string;
  status: CheckRowStatus;
  action: DockerActionKey | null;
}

export interface InstallChoice {
  option: DockerInstallOption;
  title: string;
  subtitle: string | null;
}

export interface ProgressView {
  label: string;
  progress: number | null;
  detail: string | null;
}

export function checkViews(report: DockerReport | null, phase: DockerPhase, now: number): CheckView[] {
  if (!report) {
    return PLACEHOLDER_CHECKS.map((id) => ({
      id,
      title: DOCKER_LABELS.placeholderRows[id],
      subtitle: DOCKER_LABELS.checking,
      status: "running",
      action: null,
    }));
  }
  return report.checks.map((check) => {
    if (check.id === "daemon" && phase.kind === "starting") {
      const seconds = Math.max(0, Math.floor((now - phase.since) / 1000));
      return { id: check.id, title: check.title, subtitle: DOCKER_LABELS.starting(seconds), status: "running", action: null };
    }
    return { id: check.id, title: check.title, subtitle: check.detail, status: check.status, action: check.action ?? null };
  });
}

export function isReady(report: DockerReport | null, phase: DockerPhase, platform: Platform): boolean {
  if (phase.kind === "ready") return true;
  if (!report || phase.kind !== "idle") return false;
  const required = REQUIRED_CHECKS[platform];
  return required.every((id) => report.checks.some((check) => check.id === id && check.status !== "error"));
}

export function isBusy(phase: DockerPhase): boolean {
  return BUSY_PHASES.includes(phase.kind);
}

export function isOperation(phase: DockerPhase): boolean {
  return OPERATION_PHASES.includes(phase.kind);
}

export function stepStatus(report: DockerReport | null, phase: DockerPhase, platform: Platform): StepStatus | null {
  if (isOperation(phase)) return "running";
  if (isReady(report, phase, platform)) {
    return report?.checks.some((check) => check.status === "warning") ? "warning" : "done";
  }
  if (phase.kind === "needs-relogin" || phase.kind === "needs-reboot") return "warning";
  if (phase.kind === "blocked") return "error";
  return null;
}

export function panelFor(phase: DockerPhase, requested: DockerPanel): DockerPanel {
  if (phase.kind === "needs-relogin") return "relogin";
  if (phase.kind === "needs-reboot") return "reboot";
  if (phase.kind === "installing" && requested !== "permission") return "install";
  if (phase.kind === "ready") return "none";
  return requested;
}

export function blockedReason(report: DockerReport | null, phase: DockerPhase): string | null {
  if (phase.kind !== "blocked") return null;
  const shown = report?.checks.some((check) => check.detail === phase.reason) ?? false;
  return shown ? null : phase.reason;
}

export function installChoices(platform: Platform, host: HostInfo | null): InstallChoice[] {
  const labels = DOCKER_LABELS.install.options;
  const distro = host?.distro?.prettyName ?? labels.thisDistro;
  return PLATFORM_INSTALL_OPTIONS[platform].map((option) => {
    switch (option) {
      case "desktop":
        return { option, title: labels.desktopRecommended, subtitle: null };
      case "desktop-user":
        return { option, title: labels.desktopUser, subtitle: null };
      case "engine":
        return { option, title: labels.engine, subtitle: labels.engineSubtitle(distro) };
      case "desktop-linux":
        return { option, title: labels.desktopLinux, subtitle: labels.opensDocs };
      default:
        return { option, title: labels.manual, subtitle: labels.opensDocs };
    }
  });
}

export function needsLicense(option: DockerInstallOption): boolean {
  return LICENSED_OPTIONS.includes(option);
}

export function formatBytes(bytes: number): string {
  return formatSize(bytes, BINARY_BYTE_BASE);
}

export function installProgress(phase: DockerPhase): ProgressView | null {
  if (phase.kind !== "installing") return null;
  const label = DOCKER_LABELS.install.stages[phase.stage];
  if (phase.stage !== "downloading") return { label, progress: null, detail: null };
  const progress = phase.total ? phase.received / phase.total : null;
  const detail = phase.received > 0 ? DOCKER_LABELS.install.received(formatBytes(phase.received), phase.total ? formatBytes(phase.total) : null) : null;
  return { label, progress, detail };
}

export function rebootSubject(report: DockerReport | null): string {
  return report?.windows && !report.windows.wsl ? DOCKER_LABELS.reboot.wsl : DOCKER_LABELS.reboot.desktop;
}

export function appendLog(lines: readonly string[], line: string, limit: number): string[] {
  const next = [...lines, line];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

export interface RestartCopy {
  title: string;
  message: string;
}

export function restartCopy(kind: "relogin" | "reboot", subject: string): RestartCopy {
  return kind === "relogin"
    ? { title: DOCKER_LABELS.relogin.title, message: DOCKER_LABELS.relogin.message }
    : { title: DOCKER_LABELS.reboot.title, message: DOCKER_LABELS.reboot.message(subject) };
}

export function isPrimaryAction(action: DockerActionKey): boolean {
  return PRIMARY_ACTIONS.includes(action);
}
