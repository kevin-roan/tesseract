import { MotionGlobalConfig } from "motion/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Section } from "./Section";
import { viewState } from "./view-state";

MotionGlobalConfig.skipAnimations = true;

describe("Section", () => {
  it("renders the header with subtitle and link action", () => {
    const onAction = vi.fn();
    render(
      <Section title="Resources" subtitle="Share of capacity" actionLabel="View all" onAction={onAction}>
        <span>content</span>
      </Section>,
    );
    expect(screen.getByRole("heading", { name: "Resources" })).toBeTruthy();
    expect(screen.getByText("Share of capacity")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View all" }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.getByText("content")).toBeTruthy();
  });

  it("drops the title margin in the overview variant", () => {
    const { container } = render(<Section title="Activity" variant="overview" />);
    expect(container.querySelector(".title")?.className).toContain("titleFlush");
  });

  it("shows the empty label and the loading spinner", async () => {
    const { rerender } = render(<Section title="Toolchain" empty emptyLabel="The controller reported no tools." />);
    expect(screen.getByText("The controller reported no tools.")).toBeTruthy();
    rerender(<Section title="Toolchain" loading loadingLabel="Loading" emptyLabel="The controller reported no tools." />);
    await waitFor(() => expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy());
  });

  it("resolves the view state with loading first", () => {
    expect(viewState(true, true)).toBe("loading");
    expect(viewState(false, true)).toBe("empty");
    expect(viewState(undefined, undefined)).toBe("content");
  });
});
