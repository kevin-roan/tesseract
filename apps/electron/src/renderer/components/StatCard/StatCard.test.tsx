import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TOOLTIP_OPEN_DELAY_MS, TOOLTIP_SKIP_DELAY_MS } from "../Tooltip/constants";
import { statColumns, statPercent } from "./model";
import { StatCard } from "./StatCard";
import { StatGrid } from "./StatGrid";

describe("StatCard", () => {
  it("shows value, unit, caption, percent and the bar when progress is set", () => {
    const { container } = render(
      <StatCard icon="cpu" label="CPU load" value="0.42" unit="load avg" progress={0.214} caption="8 cores · 5m 0.3" />,
    );
    expect(screen.getByText("0.42")).toBeTruthy();
    expect(screen.getByText("load avg")).toBeTruthy();
    expect(screen.getByText("8 cores · 5m 0.3")).toBeTruthy();
    expect(screen.getByText("21%")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "CPU load" }).getAttribute("aria-valuenow")).toBe("21");
    expect(container.querySelector("button")).toBeNull();
  });

  it("hides percent and bar without progress", () => {
    render(<StatCard icon="uptime" label="Uptime" value="3d" />);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText(/%$/)).toBeNull();
  });

  it("uses the warning bar for violet tiles", () => {
    render(<StatCard icon="memory" label="Memory" value="3.1 GB" progress={0.9} tone="violet" />);
    expect(screen.getByRole("progressbar").getAttribute("style")).toContain("var(--to-warning)");
  });

  it("becomes a pressable button with onActivate", () => {
    const onActivate = vi.fn();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    vi.advanceTimersByTime(TOOLTIP_SKIP_DELAY_MS + 1);
    render(<StatCard icon="disk" label="Disk" value="41 GB" onActivate={onActivate} />);
    const button = screen.getByRole("button");
    expect(button.hasAttribute("title")).toBe(false);
    fireEvent.pointerEnter(button);
    act(() => {
      vi.advanceTimersByTime(TOOLTIP_OPEN_DELAY_MS);
    });
    expect(screen.getByRole("tooltip").textContent).toBe("Disk");
    vi.useRealTimers();
    fireEvent.click(button);
    expect(onActivate).toHaveBeenCalledOnce();
  });
});

describe("StatGrid", () => {
  it("computes 2–4 columns from the width", () => {
    expect(statColumns(0)).toBe(2);
    expect(statColumns(300)).toBe(2);
    expect(statColumns(496)).toBe(3);
    expect(statColumns(968)).toBe(4);
    expect(statColumns(5000)).toBe(4);
    expect(statColumns(5000, 2, 6)).toBe(6);
  });

  it("rounds and clamps the percent", () => {
    expect(statPercent(0.895)).toBe("90%");
    expect(statPercent(1.4)).toBe("100%");
    expect(statPercent(-1)).toBe("0%");
  });

  it("renders one tile per item", () => {
    render(
      <StatGrid
        items={[
          { id: "a", icon: "cpu", label: "A", value: "1" },
          { id: "b", icon: "memory", label: "B", value: "2" },
        ]}
      />,
    );
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
  });
});
