import type { MenuItemConstructorOptions } from "electron";
import type { AppCommand } from "../../shared/contracts/app";
import type { ZoomDirection } from "../../shared/contracts/window";
import { MENU_LABELS } from "../labels";

export interface MenuActions {
  command(command: AppCommand): void;
  zoom(direction: ZoomDirection): void;
  installCli(): void;
  checkForUpdates(): void;
  closeWindow(): void;
  quit(): void;
}

export interface MenuOptions {
  devTools: boolean;
  updates: boolean;
  installCli: boolean;
}

export function macMenuTemplate(actions: MenuActions, options: MenuOptions): MenuItemConstructorOptions[] {
  const extras: MenuItemConstructorOptions[] = [
    ...(options.installCli ? [{ label: MENU_LABELS.installCli, click: () => actions.installCli() }] : []),
    ...(options.updates ? [{ label: MENU_LABELS.checkForUpdates, click: () => actions.checkForUpdates() }] : []),
  ];
  return [
    {
      role: "appMenu",
      submenu: [
        { label: MENU_LABELS.about, click: () => actions.command({ type: "about" }) },
        ...extras,
        { type: "separator" },
        { label: MENU_LABELS.preferences, accelerator: "CmdOrCtrl+,", click: () => actions.command({ type: "preferences" }) },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { label: MENU_LABELS.quit, accelerator: "CmdOrCtrl+Q", click: () => actions.quit() },
      ],
    },
    {
      label: MENU_LABELS.file,
      submenu: [
        { label: MENU_LABELS.newConversation, accelerator: "CmdOrCtrl+N", click: () => actions.command({ type: "new-conversation" }) },
        { type: "separator" },
        { label: MENU_LABELS.pair, click: () => actions.command({ type: "pair" }) },
        { label: MENU_LABELS.pairHost, click: () => actions.command({ type: "pair-host" }) },
        { label: MENU_LABELS.rediscover, click: () => actions.command({ type: "rediscover" }) },
        { type: "separator" },
        { label: MENU_LABELS.closeWindow, accelerator: "CmdOrCtrl+W", click: () => actions.closeWindow() },
      ],
    },
    { role: "editMenu", label: MENU_LABELS.edit },
    {
      label: MENU_LABELS.view,
      submenu: [
        { label: MENU_LABELS.refresh, accelerator: "CmdOrCtrl+R", click: () => actions.command({ type: "refresh" }) },
        { type: "separator" },
        { label: MENU_LABELS.actualSize, accelerator: "CmdOrCtrl+0", click: () => actions.zoom(0) },
        { label: MENU_LABELS.zoomIn, accelerator: "CmdOrCtrl+Plus", click: () => actions.zoom(1) },
        { label: MENU_LABELS.zoomIn, accelerator: "CmdOrCtrl+=", visible: false, acceleratorWorksWhenHidden: true, click: () => actions.zoom(1) },
        { label: MENU_LABELS.zoomOut, accelerator: "CmdOrCtrl+-", click: () => actions.zoom(-1) },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(options.devTools ? [{ type: "separator" as const }, { role: "toggleDevTools" as const }] : []),
      ],
    },
    { role: "windowMenu", label: MENU_LABELS.window },
    { role: "help", label: MENU_LABELS.help, submenu: [{ label: MENU_LABELS.about, click: () => actions.command({ type: "about" }) }] },
  ];
}

export function isDevToolsShortcut(input: { type: string; key: string; control: boolean; meta: boolean; shift: boolean; alt: boolean }): boolean {
  if (input.type !== "keyDown") return false;
  if (input.key === "F12") return true;
  return (input.control || input.meta) && input.shift && !input.alt && input.key.toLowerCase() === "i";
}
