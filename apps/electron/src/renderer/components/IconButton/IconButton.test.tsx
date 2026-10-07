import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IconButton } from "./IconButton";

describe("IconButton", () => {
  afterEach(() => vi.useRealTimers());

  it("uses the label for aria-label and reflects checked", () => {
    render(<IconButton icon="filter" label="Search projects" variant="bordered" checked />);
    const button = screen.getByRole("button", { name: "Search projects" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.className).toContain("bordered");
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("shows the label as a tooltip on hover", () => {
    vi.useFakeTimers();
    render(<IconButton icon="refresh" label="Refresh" />);
    fireEvent.pointerEnter(screen.getByRole("button"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("tooltip").textContent).toBe("Refresh");
  });

  it("can suppress the tooltip", () => {
    vi.useFakeTimers();
    render(<IconButton icon="close" label="Dismiss" tooltip={null} />);
    fireEvent.pointerEnter(screen.getByRole("button"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
