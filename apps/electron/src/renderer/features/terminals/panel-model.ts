import type { TerminalInfo, TerminalKind } from "@tesseract/protocol";
import type { WidthBounds } from "../../components/ResizeHandle";
import { PANEL_SIZE } from "./constants";
import { kindLabel } from "./model";

export type PanelPlacement = "bottom" | "right";

export interface PanelTab {
  id: string;
  kind: TerminalKind;
  label: string;
}

export function panelTabs(sessions: readonly TerminalInfo[] | null, projectId: string): PanelTab[] {
  const running = (sessions ?? [])
    .filter((info) => info.projectId === projectId && info.state === "running")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const seen = new Map<string, number>();
  return running.map((info) => {
    const position = (seen.get(info.kind) ?? 0) + 1;
    seen.set(info.kind, position);
    const label = position === 1 ? kindLabel(info.kind) : `${kindLabel(info.kind)} ${position}`;
    return { id: info.id, kind: info.kind, label };
  });
}

export function panelBounds(placement: PanelPlacement, available: number | null): WidthBounds {
  const { default: fallback, min, minContent } = PANEL_SIZE[placement];
  const room = available === null ? Math.max(fallback, min) : available - minContent;
  return { min, max: Math.max(min, room) };
}

export const clampPanelSize = (size: number, bounds: WidthBounds): number => Math.min(Math.max(size, bounds.min), bounds.max);
