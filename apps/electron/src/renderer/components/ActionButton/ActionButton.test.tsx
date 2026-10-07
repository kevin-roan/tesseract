import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionButton } from "./ActionButton";

describe("ActionButton", () => {
  it("renders the label, variant and size classes", () => {
    render(<ActionButton label="Create" variant="primary" size="dialog" />);
    const button = screen.getByRole("button", { name: "Create" });
    expect(button.className).toContain("primary");
    expect(button.className).toContain("dialog");
    expect(button.getAttribute("type")).toBe("button");
  });

  it("shows a spinner and aria-busy while busy", () => {
    const { container } = render(<ActionButton label="Saving" icon="save" busy />);
    expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector("[data-motion-essential]")).not.toBeNull();
  });

  it("calls onClick and respects disabled", () => {
    const onClick = vi.fn();
    const { rerender } = render(<ActionButton label="Run" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<ActionButton label="Run" onClick={onClick} disabled />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not set a native title tooltip", () => {
    render(<ActionButton label="Sync" tooltip="Sync from host" />);
    expect(screen.getByRole("button").hasAttribute("title")).toBe(false);
  });
});
