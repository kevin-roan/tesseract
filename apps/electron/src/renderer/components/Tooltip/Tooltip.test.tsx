import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOOLTIP_OPEN_DELAY_MS, TOOLTIP_SKIP_DELAY_MS } from "./constants";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    vi.advanceTimersByTime(TOOLTIP_SKIP_DELAY_MS + 1);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("opens after the hover delay and describes the anchor", () => {
    render(
      <Tooltip label="Refresh">
        <button type="button">target</button>
      </Tooltip>,
    );
    const target = screen.getByRole("button", { name: "target" });
    fireEvent.pointerEnter(target);
    expect(screen.queryByRole("tooltip")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(TOOLTIP_OPEN_DELAY_MS);
    });
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toBe("Refresh");
    expect(target.getAttribute("aria-describedby")).toBe(tooltip.id);
  });

  it("does not open when the pointer leaves before the delay", () => {
    render(
      <Tooltip label="Refresh">
        <button type="button">target</button>
      </Tooltip>,
    );
    const target = screen.getByRole("button");
    fireEvent.pointerEnter(target);
    fireEvent.pointerLeave(target);
    act(() => {
      vi.advanceTimersByTime(TOOLTIP_OPEN_DELAY_MS * 2);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("renders forced-open tooltips with a shortcut", () => {
    render(
      <Tooltip label="New conversation" shortcut="Ctrl+N" open>
        <button type="button">target</button>
      </Tooltip>,
    );
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toContain("New conversation");
    expect(tooltip.querySelector("kbd")?.getAttribute("aria-label")).toBe("Ctrl+N");
  });

  it("renders only the child when the label is empty", () => {
    render(
      <Tooltip label={null} open>
        <button type="button">target</button>
      </Tooltip>,
    );
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("button")).toBeTruthy();
  });
});
