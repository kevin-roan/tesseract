import type { TerminalInfo } from "@tesseract/protocol";
import type { HostGateModel } from "../host-shell/types";
import { META_LABELS } from "../terminals/labels";
import { kindLabel, rowModel } from "../terminals/model";
import type { LiveSession, SessionRowModel, TerminalsEmptyModel } from "../terminals/types";
import { SHELL_LABELS } from "./labels";

export function folderName(cwd: string | null | undefined): string {
  const trimmed = (cwd ?? "").replace(/[\\/]+$/, "");
  if (!trimmed) return SHELL_LABELS.home;
  return trimmed.split(/[\\/]/).pop() || trimmed;
}

export function hostSessionTitle(info: Pick<TerminalInfo, "kind" | "cwd">): string {
  return `${kindLabel(info.kind)}${META_LABELS.separator}${folderName(info.cwd)}`;
}

export function hostRowModel(info: TerminalInfo, nowMs: number, live?: LiveSession | null): SessionRowModel {
  return { ...rowModel(info, null, nowMs, live), title: hostSessionTitle(info) };
}

export function gateEmpty(gate: HostGateModel | null): TerminalsEmptyModel | null {
  if (!gate) return null;
  return {
    title: gate.title,
    message: gate.message,
    loading: gate.loading,
    icon: gate.icon,
    actionLabel: gate.actionLabel,
    secondaryLabel: gate.secondaryLabel,
  };
}
