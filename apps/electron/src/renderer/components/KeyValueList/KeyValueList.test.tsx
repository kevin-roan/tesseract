import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TOOLTIP_OPEN_DELAY_MS, TOOLTIP_SKIP_DELAY_MS } from "../Tooltip/constants";
import { KeyValueList } from "./KeyValueList";

describe("KeyValueList", () => {
  it("renders rows in the given order", () => {
    const { container } = render(
      <KeyValueList
        rows={[
          ["Remote", "origin/main"],
          ["Branch", "main"],
        ]}
      />,
    );
    expect(container.textContent).toBe("Remoteorigin/mainBranchmain");
    expect(screen.getByText("origin/main").hasAttribute("title")).toBe(false);
  });

  it("shows the full value in a tooltip only when it is truncated", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    vi.advanceTimersByTime(TOOLTIP_SKIP_DELAY_MS + 1);
    render(<KeyValueList rows={[["Remote", "origin/main"]]} />);
    const value = screen.getByText("origin/main");
    fireEvent.pointerEnter(value);
    act(() => {
      vi.advanceTimersByTime(TOOLTIP_OPEN_DELAY_MS);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.pointerLeave(value);
    Object.defineProperty(value, "scrollWidth", { configurable: true, value: 200 });
    Object.defineProperty(value, "clientWidth", { configurable: true, value: 100 });
    fireEvent.pointerEnter(value);
    act(() => {
      vi.advanceTimersByTime(TOOLTIP_OPEN_DELAY_MS);
    });
    expect(screen.getByRole("tooltip").textContent).toBe("origin/main");
    vi.useRealTimers();
  });
});
