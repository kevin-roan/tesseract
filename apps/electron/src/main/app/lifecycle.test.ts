import { describe, expect, it } from "vitest";
import { isQuitting, markQuitting, setHideOnClose, shouldHideOnClose } from "./lifecycle";

describe("lifecycle", () => {
  it("hides on close while the tray is attached, until the app quits", () => {
    expect(shouldHideOnClose()).toBe(false);
    setHideOnClose(true);
    expect(shouldHideOnClose()).toBe(true);
    markQuitting();
    expect(isQuitting()).toBe(true);
    expect(shouldHideOnClose()).toBe(false);
  });
});
