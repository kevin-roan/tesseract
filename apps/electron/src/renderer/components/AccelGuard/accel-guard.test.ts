import { describe, expect, it, vi } from "vitest";
import { createAccelGuard, isGuardExempt, shouldSuspendShortcut } from "./accel-guard";

const keys = (overrides: Partial<{ ctrlKey: boolean; shiftKey: boolean; metaKey: boolean }> = {}) => ({
  ctrlKey: false,
  shiftKey: false,
  metaKey: false,
  ...overrides,
});

describe("accel guard", () => {
  it("reference counts and ignores extra releases", () => {
    const guard = createAccelGuard();
    const listener = vi.fn();
    guard.subscribe(listener);
    const first = guard.acquire();
    const second = guard.acquire();
    expect(guard.active).toBe(true);
    first();
    first();
    expect(guard.active).toBe(true);
    second();
    expect(guard.active).toBe(false);
    guard.release();
    expect(guard.count).toBe(0);
    expect(listener.mock.calls).toEqual([[true], [false]]);
  });

  it("exempts Super and Ctrl+Shift combinations", () => {
    expect(isGuardExempt(keys({ metaKey: true }))).toBe(true);
    expect(isGuardExempt(keys({ ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(isGuardExempt(keys({ ctrlKey: true }))).toBe(false);
    expect(isGuardExempt(keys())).toBe(false);
  });

  it("suspends shortcuts only while active", () => {
    const guard = createAccelGuard();
    expect(shouldSuspendShortcut(keys({ ctrlKey: true }), guard)).toBe(false);
    const release = guard.acquire();
    expect(shouldSuspendShortcut(keys({ ctrlKey: true }), guard)).toBe(true);
    expect(shouldSuspendShortcut(keys(), guard)).toBe(true);
    expect(shouldSuspendShortcut(keys({ ctrlKey: true, shiftKey: true }), guard)).toBe(false);
    release();
    expect(shouldSuspendShortcut(keys({ ctrlKey: true }), guard)).toBe(false);
  });
});
