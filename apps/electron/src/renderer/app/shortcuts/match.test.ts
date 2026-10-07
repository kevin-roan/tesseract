import { describe, expect, it } from "vitest";
import { findShortcut, handledByNativeMenu, matchesAccelerator, parseAccelerator, type KeyInput } from "./match";
import { SHORTCUT_ORDER } from "./constants";

const press = (key: string, modifiers: Partial<KeyInput> = {}): KeyInput => ({
  key,
  code: modifiers.code ?? (key.length === 1 && /[a-z]/i.test(key) ? `Key${key.toUpperCase()}` : ""),
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...modifiers,
});

describe("parseAccelerator", () => {
  it("maps CmdOrCtrl to Cmd on macOS and Ctrl elsewhere", () => {
    expect(parseAccelerator("CmdOrCtrl+K", "darwin")).toMatchObject({ meta: true, ctrl: false, key: "k" });
    expect(parseAccelerator("CmdOrCtrl+K", "linux")).toMatchObject({ meta: false, ctrl: true, key: "k" });
    expect(parseAccelerator("CmdOrCtrl+Shift+-", "win32")).toMatchObject({ ctrl: true, shift: true, key: "-" });
  });
});

describe("matchesAccelerator", () => {
  it("requires the exact modifiers", () => {
    const accel = parseAccelerator("CmdOrCtrl+K", "linux");
    expect(matchesAccelerator(accel, press("k", { ctrlKey: true }))).toBe(true);
    expect(matchesAccelerator(accel, press("k", { ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(matchesAccelerator(accel, press("k", { metaKey: true }))).toBe(false);
    expect(matchesAccelerator(accel, press("k"))).toBe(false);
  });

  it("matches Ctrl+Plus with or without Shift", () => {
    const accel = parseAccelerator("CmdOrCtrl+Plus", "linux");
    expect(matchesAccelerator(accel, press("+", { ctrlKey: true, shiftKey: true, code: "Equal" }))).toBe(true);
    expect(matchesAccelerator(accel, press("+", { ctrlKey: true, code: "BracketRight" }))).toBe(true);
  });

  it("distinguishes keypad keys by code", () => {
    expect(matchesAccelerator(parseAccelerator("Ctrl+NumpadAdd", "linux"), press("+", { ctrlKey: true, code: "NumpadAdd" }))).toBe(true);
    expect(matchesAccelerator(parseAccelerator("Ctrl+0", "linux"), press("0", { ctrlKey: true, code: "Numpad0" }))).toBe(false);
    expect(matchesAccelerator(parseAccelerator("Ctrl+Numpad0", "linux"), press("0", { ctrlKey: true, code: "Numpad0" }))).toBe(true);
  });

  it("falls back to the physical key on non-Latin layouts only", () => {
    const accel = parseAccelerator("Ctrl+K", "linux");
    expect(matchesAccelerator(accel, press("л", { ctrlKey: true, code: "KeyK" }))).toBe(true);
    expect(matchesAccelerator(accel, press("t", { ctrlKey: true, code: "KeyK" }))).toBe(false);
  });
});

describe("findShortcut", () => {
  it("resolves the GTK accelerators", () => {
    expect(findShortcut(press("k", { ctrlKey: true }), "linux", SHORTCUT_ORDER)?.id).toBe("palette");
    expect(findShortcut(press("F5", { code: "F5" }), "linux", SHORTCUT_ORDER)?.id).toBe("refresh");
    expect(findShortcut(press(",", { ctrlKey: true, code: "Comma" }), "linux", SHORTCUT_ORDER)?.id).toBe("preferences");
    expect(findShortcut(press("=", { ctrlKey: true, code: "Equal" }), "linux", SHORTCUT_ORDER)?.id).toBe("zoomIn");
    expect(findShortcut(press("-", { ctrlKey: true, code: "Minus" }), "linux", SHORTCUT_ORDER)?.id).toBe("zoomOut");
    expect(findShortcut(press("0", { ctrlKey: true, code: "Digit0" }), "linux", SHORTCUT_ORDER)?.id).toBe("zoomReset");
    expect(findShortcut(press("n", { metaKey: true }), "darwin", SHORTCUT_ORDER)?.id).toBe("newConversation");
    expect(findShortcut(press("n", { ctrlKey: true }), "darwin", SHORTCUT_ORDER)).toBeNull();
  });

  it("leaves macOS menu accelerators to the native menu", () => {
    expect(handledByNativeMenu("CmdOrCtrl+Q", "darwin")).toBe(true);
    expect(handledByNativeMenu("CmdOrCtrl+Q", "linux")).toBe(false);
    expect(handledByNativeMenu("CmdOrCtrl+K", "darwin")).toBe(false);
    expect(handledByNativeMenu("F5", "darwin")).toBe(false);
  });
});
