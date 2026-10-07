import { describe, expect, it } from "vitest";
import { keyToMove, moveIndex } from "./use-palette-navigation";

const key = (name: string, modifiers: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({
  key: name,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers,
});

describe("palette navigation", () => {
  it("wraps around the list", () => {
    expect(moveIndex(0, 3, "next")).toBe(1);
    expect(moveIndex(2, 3, "next")).toBe(0);
    expect(moveIndex(0, 3, "previous")).toBe(2);
    expect(moveIndex(1, 3, "last")).toBe(2);
    expect(moveIndex(1, 0, "next")).toBe(-1);
  });

  it("maps arrows, page keys and Ctrl+N/P", () => {
    expect(keyToMove(key("ArrowDown"))).toBe("next");
    expect(keyToMove(key("ArrowUp"))).toBe("previous");
    expect(keyToMove(key("ArrowDown", { metaKey: true }))).toBe("last");
    expect(keyToMove(key("PageUp"))).toBe("first");
    expect(keyToMove(key("n", { ctrlKey: true }))).toBe("next");
    expect(keyToMove(key("p", { ctrlKey: true }))).toBe("previous");
    expect(keyToMove(key("ArrowDown", { shiftKey: true }))).toBeNull();
    expect(keyToMove(key("a"))).toBeNull();
  });
});
