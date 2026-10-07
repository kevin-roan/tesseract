import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOAST_TIMEOUT_MS } from "./constants";
import { showToast, useToastStore } from "./store";
import { ToastHost } from "./ToastHost";

const scopeQueue = (scope: string) => useToastStore.getState().queue.filter((item) => item.scope === scope);

describe("toasts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({ queue: [] });
  });
  afterEach(() => vi.useRealTimers());

  it("shows one toast per scope at a time and expires it", () => {
    render(<ToastHost scope="test" />);
    act(() => {
      showToast("First", { scope: "test" });
      showToast("Second", { scope: "test" });
      showToast("Elsewhere", { scope: "other" });
    });
    expect(screen.getByText("First")).toBeTruthy();
    expect(screen.queryByText("Second")).toBeNull();
    expect(screen.queryByText("Elsewhere")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(TOAST_TIMEOUT_MS.default);
    });
    expect(scopeQueue("test").map((item) => item.message)).toEqual(["Second"]);
  });

  it("pauses the timeout while hovered", () => {
    render(<ToastHost scope="test" />);
    act(() => {
      showToast("Hover me", { scope: "test", timeoutMs: 1000 });
    });
    fireEvent.pointerEnter(screen.getByRole("status").parentElement as HTMLElement);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(scopeQueue("test")).toHaveLength(1);
    fireEvent.pointerLeave(screen.getByRole("status").parentElement as HTMLElement);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(scopeQueue("test")).toHaveLength(0);
  });

  it("runs the action and dismisses", () => {
    const run = vi.fn();
    render(<ToastHost scope="test" />);
    act(() => {
      showToast("Archived", { scope: "test", action: { label: "Undo", run } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(scopeQueue("test")).toHaveLength(0);
  });

  it("drops the scope's queued toasts when its host unmounts", () => {
    const { unmount } = render(<ToastHost scope="dialog" />);
    act(() => {
      showToast("Pairing link copied", { scope: "dialog" });
      showToast("Queued", { scope: "dialog" });
      showToast("Window", { scope: "window" });
    });
    unmount();
    expect(scopeQueue("dialog")).toHaveLength(0);
    expect(scopeQueue("window")).toHaveLength(1);
    render(<ToastHost scope="dialog" />);
    expect(screen.queryByText("Pairing link copied")).toBeNull();
  });

  it("dismisses from the close button", () => {
    render(<ToastHost scope="test" />);
    act(() => {
      showToast("Copied", { scope: "test" });
    });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(scopeQueue("test")).toHaveLength(0);
  });
});
