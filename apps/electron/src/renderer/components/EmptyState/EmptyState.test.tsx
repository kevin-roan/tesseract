import { MotionGlobalConfig } from "motion/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "./EmptyState";

MotionGlobalConfig.skipAnimations = true;

describe("EmptyState", () => {
  it("renders title, message and both actions", () => {
    const onAction = vi.fn();
    const onSecondary = vi.fn();
    render(<EmptyState title="No projects" message="Create one" actionLabel="New" onAction={onAction} secondaryLabel="Docs" onSecondary={onSecondary} />);
    expect(screen.getByRole("heading", { name: "No projects" })).toBeTruthy();
    expect(screen.getByText("Create one")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    fireEvent.click(screen.getByRole("button", { name: "Docs" }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(onSecondary).toHaveBeenCalledOnce();
  });

  it("hides the actions row and message when absent", () => {
    const { container } = render(<EmptyState title="Nothing" icon={null} />);
    expect(container.querySelector(".actions")).toBeNull();
    expect(container.querySelector("p")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("shows a spinner instead of the icon while loading", () => {
    const { container } = render(<EmptyState title="Loading" loading />);
    expect(container.querySelector("[data-motion-essential]")).toBeTruthy();
    expect(container.firstElementChild?.getAttribute("aria-busy")).toBe("true");
  });
});
