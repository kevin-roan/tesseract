import { MotionGlobalConfig } from "motion/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PillTabs } from "./PillTabs";
import { nextTabId } from "./use-pill-tabs";

MotionGlobalConfig.skipAnimations = true;

const TABS = [
  { id: "all", label: "All projects" },
  { id: "active", label: "Active", count: 3 },
  { id: "idle", label: "Idle", count: 0 },
];

describe("PillTabs", () => {
  it("renders a tablist with the selected tab and hides zero counts", () => {
    render(<PillTabs tabs={TABS} selected="all" onChange={() => undefined} label="Filter" />);
    expect(screen.getByRole("tablist", { name: "Filter" })).toBeTruthy();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(tabs[1]?.textContent).toBe("Active3");
    expect(tabs[2]?.textContent).toBe("Idle");
  });

  it("fires onChange only when the selection changes", () => {
    const onChange = vi.fn();
    render(<PillTabs tabs={TABS} selected="all" onChange={onChange} label="Filter" />);
    fireEvent.click(screen.getByRole("tab", { name: "All projects" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: /Active/ }));
    expect(onChange).toHaveBeenCalledWith("active");
  });

  it("moves the selection with arrow keys", () => {
    const onChange = vi.fn();
    render(<PillTabs tabs={TABS} selected="all" onChange={onChange} label="Filter" />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "All projects" }), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith("idle");
  });

  it("computes keyboard targets", () => {
    expect(nextTabId(TABS, "all", "ArrowRight")).toBe("active");
    expect(nextTabId(TABS, "idle", "ArrowRight")).toBe("all");
    expect(nextTabId(TABS, "active", "Home")).toBe("all");
    expect(nextTabId(TABS, "all", "End")).toBe("idle");
    expect(nextTabId(TABS, "all", "a")).toBeNull();
    expect(nextTabId([], "all", "ArrowRight")).toBeNull();
  });
});
