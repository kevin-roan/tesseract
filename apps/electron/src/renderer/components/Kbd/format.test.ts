import { describe, expect, it } from "vitest";
import { formatAccelerator } from "./format";

describe("formatAccelerator", () => {
  it("maps CmdOrCtrl per platform", () => {
    expect(formatAccelerator("CmdOrCtrl+K", "darwin")).toEqual(["⌘", "K"]);
    expect(formatAccelerator("CmdOrCtrl+K", "linux")).toEqual(["Ctrl", "K"]);
    expect(formatAccelerator("CmdOrCtrl+K", "win32")).toEqual(["Ctrl", "K"]);
  });

  it("orders modifiers consistently", () => {
    expect(formatAccelerator("Shift+CmdOrCtrl+P", "linux")).toEqual(["Ctrl", "Shift", "P"]);
    expect(formatAccelerator("Cmd+Shift+Alt+Ctrl+P", "darwin")).toEqual(["⌃", "⌥", "⇧", "⌘", "P"]);
  });

  it("handles plus keys and named keys", () => {
    expect(formatAccelerator("Ctrl++", "linux")).toEqual(["Ctrl", "+"]);
    expect(formatAccelerator("Ctrl+Plus", "linux")).toEqual(["Ctrl", "+"]);
    expect(formatAccelerator("Shift+Enter", "darwin")).toEqual(["⇧", "↩"]);
    expect(formatAccelerator("Esc", "linux")).toEqual(["Esc"]);
    expect(formatAccelerator("Alt+Up", "win32")).toEqual(["Alt", "↑"]);
    expect(formatAccelerator("f5", "linux")).toEqual(["F5"]);
  });

  it("accepts pre-split key arrays", () => {
    expect(formatAccelerator(["Meta", "a"], "linux")).toEqual(["Super", "A"]);
  });
});
