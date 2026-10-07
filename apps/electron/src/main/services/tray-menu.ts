import type { MenuItemConstructorOptions } from "electron";
import type { AppCommand } from "../../shared/contracts/app";
import type { Platform } from "../../shared/runtime";
import { TRAY_ICON } from "../constants";
import { TRAY_LABELS } from "../labels";

export interface TrayActions {
  open(): void;
  hide(): void;
  command(command: AppCommand): void;
  installUpdate(): void;
  quit(): void;
}

export interface TrayMenuOptions {
  updateReady: string | null;
}

export function trayMenuTemplate(actions: TrayActions, options: TrayMenuOptions): MenuItemConstructorOptions[] {
  const update: MenuItemConstructorOptions[] = options.updateReady
    ? [{ label: TRAY_LABELS.restartToUpdate(options.updateReady), click: () => actions.installUpdate() }]
    : [];
  return [
    { label: TRAY_LABELS.open, click: () => actions.open() },
    { label: TRAY_LABELS.hide, click: () => actions.hide() },
    { label: TRAY_LABELS.refresh, click: () => actions.command({ type: "refresh" }) },
    { label: TRAY_LABELS.pair, click: () => actions.command({ type: "pair" }) },
    { label: TRAY_LABELS.pairHost, click: () => actions.command({ type: "pair-host" }) },
    { label: TRAY_LABELS.preferences, click: () => actions.command({ type: "preferences" }) },
    { type: "separator" },
    ...update,
    { label: TRAY_LABELS.quit, click: () => actions.quit() },
  ];
}

export interface TrayIconChoice {
  segments: readonly string[];
  size: number;
  template: boolean;
}

export function trayIconChoices(target: Platform): TrayIconChoice[] {
  const size = TRAY_ICON.size[target];
  const fallback = { segments: TRAY_ICON.default, size, template: false };
  return target === "darwin" ? [{ segments: TRAY_ICON.macTemplate, size, template: true }, fallback] : [fallback];
}

export function togglesOnClick(target: Platform): boolean {
  return target !== "darwin";
}
