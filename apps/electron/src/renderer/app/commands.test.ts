import { describe, expect, it, vi } from "vitest";
import { dispatchRouteAction, isRouteAction, registerCommandHandler } from "./commands";

describe("route actions", () => {
  it("accepts only dialog actions", () => {
    expect(isRouteAction("pair")).toBe(true);
    expect(isRouteAction("pair-host")).toBe(true);
    expect(isRouteAction("about")).toBe(true);
    expect(isRouteAction("refresh")).toBe(false);
    expect(isRouteAction(null)).toBe(false);
  });

  it("delivers an action to a handler registered later", () => {
    dispatchRouteAction("pair-host");
    const handler = vi.fn(() => true);
    const dispose = registerCommandHandler(handler);
    expect(handler).toHaveBeenCalledWith({ type: "pair-host" });
    dispose();
    const late = vi.fn(() => true);
    registerCommandHandler(late)();
    expect(late).not.toHaveBeenCalled();
  });

  it("dispatches straight to a registered handler", () => {
    const handler = vi.fn((command: { type: string }) => command.type === "about");
    const dispose = registerCommandHandler(handler);
    dispatchRouteAction("about");
    expect(handler).toHaveBeenCalledWith({ type: "about" });
    dispose();
  });
});
