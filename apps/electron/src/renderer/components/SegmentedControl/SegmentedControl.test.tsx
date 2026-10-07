import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEVICE_SEGMENTS } from "./gallery-samples";
import { SegmentedControl } from "./SegmentedControl";

describe("SegmentedControl", () => {
  it("fires onChange only for a new selection", () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={DEVICE_SEGMENTS} value="phone" onChange={onChange} ariaLabel="Device" />);
    fireEvent.click(screen.getByRole("radio", { name: "Phone" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: "Desktop" }));
    expect(onChange).toHaveBeenCalledWith("desktop");
  });

  it("moves the selection with arrow keys", () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={DEVICE_SEGMENTS} value="desktop" onChange={onChange} ariaLabel="Device" />);
    fireEvent.keyDown(screen.getByRole("radiogroup", { name: "Device" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("phone");
  });

  it("focuses the newly selected segment when a disabled one comes first", () => {
    const options = [
      { id: "a", label: "A", disabled: true },
      { id: "b", label: "B" },
      { id: "c", label: "C" },
    ];
    let value = "b";
    const { rerender } = render(<SegmentedControl options={options} value={value} onChange={(id) => (value = id)} ariaLabel="Pick" />);
    fireEvent.keyDown(screen.getByRole("radiogroup", { name: "Pick" }), { key: "ArrowRight" });
    rerender(<SegmentedControl options={options} value={value} onChange={(id) => (value = id)} ariaLabel="Pick" />);
    expect(value).toBe("c");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "C" }));
  });

  it("marks the checked segment", () => {
    render(<SegmentedControl options={DEVICE_SEGMENTS} value="desktop" ariaLabel="Device" />);
    expect(screen.getByRole("radio", { name: "Desktop" }).getAttribute("aria-checked")).toBe("true");
  });
});
