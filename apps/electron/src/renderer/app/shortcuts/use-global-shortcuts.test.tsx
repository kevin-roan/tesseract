import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accelGuard } from "../../components/AccelGuard";
import { usePaletteStore } from "../palette/store";
import type { ShortcutId } from "./constants";
import { useGlobalShortcuts } from "./use-global-shortcuts";
import type { ShortcutActions } from "./use-shortcut-actions";

function actions(): ShortcutActions {
  const ids: ShortcutId[] = ["palette", "quit", "preferences", "refresh", "hide", "newConversation", "zoomIn", "zoomOut", "zoomReset"];
  return Object.fromEntries(ids.map((id) => [id, vi.fn()])) as unknown as ShortcutActions;
}

function key(init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
}

describe("useGlobalShortcuts", () => {
  beforeEach(() => usePaletteStore.setState({ open: false, query: "" }));
  afterEach(() => accelGuard.reset());

  it("dispatches the matching action and prevents the default", () => {
    const spy = actions();
    renderHook(() => useGlobalShortcuts(spy));
    const event = key({ key: "k", code: "KeyK", ctrlKey: true });
    expect(spy.palette).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    key({ key: "F5", code: "F5" });
    expect(spy.refresh).toHaveBeenCalledTimes(1);
  });

  it("ignores repeats except for zoom", () => {
    const spy = actions();
    renderHook(() => useGlobalShortcuts(spy));
    key({ key: "n", code: "KeyN", ctrlKey: true, repeat: true });
    expect(spy.newConversation).not.toHaveBeenCalled();
    key({ key: "=", code: "Equal", ctrlKey: true, repeat: true });
    expect(spy.zoomIn).toHaveBeenCalledTimes(1);
  });

  it("suspends shortcuts while a terminal holds the accel guard, except Ctrl+Shift", () => {
    const spy = actions();
    renderHook(() => useGlobalShortcuts(spy));
    const release = accelGuard.acquire();
    key({ key: "r", code: "KeyR", ctrlKey: true });
    expect(spy.refresh).not.toHaveBeenCalled();
    release();
    key({ key: "r", code: "KeyR", ctrlKey: true });
    expect(spy.refresh).toHaveBeenCalledTimes(1);
  });

  it("skips events another handler already consumed", () => {
    const spy = actions();
    renderHook(() => useGlobalShortcuts(spy));
    const stop = (event: KeyboardEvent) => event.preventDefault();
    window.addEventListener("keydown", stop, true);
    key({ key: "q", code: "KeyQ", ctrlKey: true });
    window.removeEventListener("keydown", stop, true);
    expect(spy.quit).not.toHaveBeenCalled();
  });
});
