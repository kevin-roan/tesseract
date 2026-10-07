import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TOOLTIP_OPEN_DELAY_MS, TOOLTIP_SKIP_DELAY_MS } from "../Tooltip/constants";
import { legendTooltip, toggleHidden } from "./model";
import { SeriesLegend } from "./SeriesLegend";
import type { LegendItem } from "./types";

const items: LegendItem[] = [
  { key: "cpu", label: "CPU load", color: 0, value: "34%", caption: "avg 31% · peak 80%" },
  { key: "mem", label: "Memory", color: 1, value: null },
];

describe("toggleHidden", () => {
  it("hides and shows series in item order", () => {
    expect(toggleHidden(["a", "b", "c"], [], "b")).toEqual(["b"]);
    expect(toggleHidden(["a", "b", "c"], ["c"], "a")).toEqual(["a", "c"]);
    expect(toggleHidden(["a", "b", "c"], ["a", "b"], "a")).toEqual(["b"]);
  });

  it("keeps the last visible series on", () => {
    expect(toggleHidden(["a", "b"], ["a"], "b")).toEqual(["a"]);
  });
});

describe("SeriesLegend", () => {
  it("renders values, the missing placeholder and tooltips", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    vi.advanceTimersByTime(TOOLTIP_SKIP_DELAY_MS + 1);
    render(<SeriesLegend items={items} hidden={["mem"]} />);
    const cpu = screen.getByRole("button", { name: "CPU load" });
    expect(cpu.getAttribute("aria-pressed")).toBe("true");
    fireEvent.pointerEnter(cpu);
    act(() => {
      vi.advanceTimersByTime(TOOLTIP_OPEN_DELAY_MS);
    });
    expect(screen.getByRole("tooltip").textContent).toBe("CPU load · avg 31% · peak 80%");
    fireEvent.pointerLeave(cpu);
    expect(cpu.textContent).toContain("34%");
    const memory = screen.getByRole("button", { name: "Memory" });
    expect(memory.getAttribute("aria-pressed")).toBe("false");
    expect(memory.textContent).toContain("—");
    expect(legendTooltip({ label: "Memory", caption: null })).toBe("Memory");
    vi.useRealTimers();
  });

  it("reports changes and ignores hiding the last visible series", () => {
    const onChange = vi.fn();
    render(<SeriesLegend items={items} hidden={["mem"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "CPU load" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Memory" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
