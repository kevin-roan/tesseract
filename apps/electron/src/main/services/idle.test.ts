import { describe, expect, it, vi } from "vitest";
import type { WebContents } from "electron";
import { deliverWhenReady, isRendererIdle, markRendererIdle, trackRendererLoad } from "./idle";

function fakeContents(id: number) {
  const listeners = new Map<string, () => void>();
  const contents = {
    id,
    isDestroyed: () => false,
    on: (event: string, listener: () => void) => listeners.set(event, listener),
    once: (event: string, listener: () => void) => listeners.set(event, listener),
  } as unknown as WebContents;
  return { contents, emit: (event: string) => listeners.get(event)?.() };
}

describe("deliverWhenReady", () => {
  it("queues deliveries until the renderer reports ready", () => {
    const { contents } = fakeContents(1);
    trackRendererLoad(contents);
    const deliver = vi.fn();
    deliverWhenReady(contents, deliver);
    expect(deliver).not.toHaveBeenCalled();
    markRendererIdle(1);
    expect(deliver).toHaveBeenCalledTimes(1);
    deliverWhenReady(contents, deliver);
    expect(deliver).toHaveBeenCalledTimes(2);
  });

  it("forgets readiness when the page reloads", () => {
    const { contents, emit } = fakeContents(2);
    trackRendererLoad(contents);
    markRendererIdle(2);
    emit("did-start-loading");
    expect(isRendererIdle(2)).toBe(false);
    const deliver = vi.fn();
    deliverWhenReady(contents, deliver);
    expect(deliver).not.toHaveBeenCalled();
    markRendererIdle(2);
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it("drops queued deliveries when the contents are destroyed", () => {
    const { contents, emit } = fakeContents(3);
    trackRendererLoad(contents);
    const deliver = vi.fn();
    deliverWhenReady(contents, deliver);
    emit("destroyed");
    markRendererIdle(3);
    expect(deliver).not.toHaveBeenCalled();
  });
});
