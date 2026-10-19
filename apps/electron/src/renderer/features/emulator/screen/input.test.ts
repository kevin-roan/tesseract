import { describe, expect, it } from "vitest";
import { ANDROID_SCREEN } from "../constants";
import { chunkText, keyMessage, PointerSlots, textMessages, toScreenPoint, wheelSteps } from "./input";

const key = (value: string, patch: Partial<{ ctrlKey: boolean; altKey: boolean; metaKey: boolean }> = {}) => ({
  key: value,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...patch,
});

describe("screen input", () => {
  it("hands out the lowest free pointer slot", () => {
    const slots = new PointerSlots(2);
    expect(slots.acquire(10)).toBe(0);
    expect(slots.acquire(11)).toBe(1);
    expect(slots.acquire(12)).toBeNull();
    expect(slots.release(10)).toBe(0);
    expect(slots.acquire(12)).toBe(0);
  });

  it("maps client coordinates into the device space", () => {
    const rect = { left: 10, top: 20, width: 100, height: 200 };
    expect(toScreenPoint(rect, { width: 1080, height: 2400 }, 60, 120)).toEqual({ x: 540, y: 1200, width: 1080, height: 2400 });
    expect(toScreenPoint(rect, { width: 1080, height: 2400 }, 500, -5)).toEqual({ x: 1079, y: 0, width: 1080, height: 2400 });
    expect(toScreenPoint(rect, null, 0, 0)).toBeNull();
  });

  it("chunks text by UTF-8 bytes without splitting characters", () => {
    expect(chunkText("abcdé", 4)).toEqual(["abcd", "é"]);
    expect(chunkText("😀😀", 4)).toEqual(["😀", "😀"]);
    expect(textMessages("hi\nyo", ANDROID_SCREEN)).toEqual([
      { type: "text", text: "hi" },
      { type: "key", key: "enter" },
      { type: "text", text: "yo" },
    ]);
  });

  it("turns key presses into keys or text", () => {
    expect(keyMessage(key("Backspace"), ANDROID_SCREEN)).toEqual({ type: "key", key: "del" });
    expect(keyMessage(key("a"), ANDROID_SCREEN)).toEqual({ type: "text", text: "a" });
    expect(keyMessage(key("a", { ctrlKey: true }), ANDROID_SCREEN)).toBeNull();
    expect(keyMessage(key("Shift"), ANDROID_SCREEN)).toBeNull();
  });

  it("scales and clamps wheel deltas", () => {
    expect(wheelSteps({ deltaX: 0, deltaY: 200, deltaMode: 0 }, ANDROID_SCREEN)).toEqual({ hscroll: 0, vscroll: -2 });
    expect(wheelSteps({ deltaX: 9_999, deltaY: 0, deltaMode: 1 }, ANDROID_SCREEN).hscroll).toBe(ANDROID_SCREEN.maxScroll);
  });
});
