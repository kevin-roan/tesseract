import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it, vi } from "vitest";
import { MENU_LABELS } from "../labels";
import { isDevToolsShortcut, macMenuTemplate, type MenuActions } from "./menu";

function actions(): MenuActions {
  return { command: vi.fn(), zoom: vi.fn(), installCli: vi.fn(), checkForUpdates: vi.fn(), closeWindow: vi.fn(), quit: vi.fn() };
}

function flatten(items: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return items.flatMap((item) => [item, ...(Array.isArray(item.submenu) ? flatten(item.submenu) : [])]);
}

function click(item: MenuItemConstructorOptions | undefined): void {
  (item?.click as (() => void) | undefined)?.();
}

describe("macMenuTemplate", () => {
  it("routes app commands and zoom through the actions", () => {
    const spy = actions();
    const items = flatten(macMenuTemplate(spy, { devTools: false, updates: false, installCli: false }));
    click(items.find((item) => item.label === MENU_LABELS.preferences));
    click(items.find((item) => item.label === MENU_LABELS.newConversation));
    click(items.find((item) => item.accelerator === "CmdOrCtrl+0"));
    click(items.find((item) => item.accelerator === "CmdOrCtrl+="));
    expect(spy.command).toHaveBeenCalledWith({ type: "preferences" });
    expect(spy.command).toHaveBeenCalledWith({ type: "new-conversation" });
    expect(spy.zoom).toHaveBeenNthCalledWith(1, 0);
    expect(spy.zoom).toHaveBeenNthCalledWith(2, 1);
  });

  it("only lists install, updates and dev tools when enabled", () => {
    const off = flatten(macMenuTemplate(actions(), { devTools: false, updates: false, installCli: false }));
    const on = flatten(macMenuTemplate(actions(), { devTools: true, updates: true, installCli: true }));
    expect(off.some((item) => item.label === MENU_LABELS.installCli || item.label === MENU_LABELS.checkForUpdates)).toBe(false);
    expect(off.some((item) => item.role === "toggleDevTools")).toBe(false);
    expect(on.some((item) => item.label === MENU_LABELS.installCli)).toBe(true);
    expect(on.some((item) => item.label === MENU_LABELS.checkForUpdates)).toBe(true);
    expect(on.some((item) => item.role === "toggleDevTools")).toBe(true);
  });

  it("keeps the edit menu so Cmd+C/V work", () => {
    expect(macMenuTemplate(actions(), { devTools: false, updates: false, installCli: false }).some((item) => item.role === "editMenu")).toBe(true);
  });
});

describe("isDevToolsShortcut", () => {
  const base = { type: "keyDown", key: "i", control: false, meta: false, shift: false, alt: false };
  it("matches F12 and Ctrl/Cmd+Shift+I on key down only", () => {
    expect(isDevToolsShortcut({ ...base, key: "F12" })).toBe(true);
    expect(isDevToolsShortcut({ ...base, control: true, shift: true, key: "I" })).toBe(true);
    expect(isDevToolsShortcut({ ...base, meta: true, shift: true })).toBe(true);
    expect(isDevToolsShortcut({ ...base, control: true })).toBe(false);
    expect(isDevToolsShortcut({ ...base, type: "keyUp", key: "F12" })).toBe(false);
  });
});
