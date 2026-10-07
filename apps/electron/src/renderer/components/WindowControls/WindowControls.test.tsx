import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { glyphOrigin, glyphPaths } from "./geometry";
import { WindowControlsView } from "./WindowControls";

describe("window control glyphs", () => {
  it("snaps the 10px glyph box to the half pixel inside the 14px canvas", () => {
    expect(glyphOrigin()).toBe(2.5);
    expect(glyphOrigin(15)).toBe(2.5);
  });

  it("draws the GTK glyph geometry", () => {
    const paths = glyphPaths();
    expect(paths.minimize).toBe("M2.5 7.5H11.5");
    expect(paths.close).toBe("M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5");
    expect(paths.maximize.startsWith("M4 2.5H10A1.5 1.5 0 0 1 11.5 4V10")).toBe(true);
    expect(paths.restore).toContain("M4.5 4V2.5H11.5V9.5H10");
    expect(paths.restore.startsWith("M4 4.5H8A1.5 1.5")).toBe(true);
  });
});

describe("WindowControlsView", () => {
  it("renders minimize, maximize and close in order and wires the handlers", () => {
    const onMinimize = vi.fn();
    const onToggleMaximize = vi.fn();
    const onClose = vi.fn();
    render(<WindowControlsView onMinimize={onMinimize} onToggleMaximize={onToggleMaximize} onClose={onClose} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(["Minimize", "Maximize", "Close"]);
    buttons.forEach((button) => fireEvent.click(button));
    expect(onMinimize).toHaveBeenCalledOnce();
    expect(onToggleMaximize).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("swaps the maximize label to Restore and marks the backdrop state", () => {
    render(<WindowControlsView maximized backdrop />);
    expect(screen.getByRole("button", { name: "Restore" })).toBeTruthy();
    expect(screen.getByRole("group").hasAttribute("data-backdrop")).toBe(true);
  });
});
