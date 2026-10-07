import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "./Switch";

describe("Switch", () => {
  it("toggles through onChange with the next value", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Serve" />);
    const control = screen.getByRole("switch", { name: "Serve" });
    expect(control.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(control);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not fire when disabled", () => {
    const onChange = vi.fn();
    render(<Switch checked onChange={onChange} label="Serve" disabled />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
