import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("reports the toggled value", () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Remember" />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Remember" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("turns a mixed state into checked", () => {
    const onChange = vi.fn();
    render(<Checkbox checked="mixed" onChange={onChange} ariaLabel="All" />);
    const box = screen.getByRole("checkbox", { name: "All" });
    expect(box.getAttribute("aria-checked")).toBe("mixed");
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
