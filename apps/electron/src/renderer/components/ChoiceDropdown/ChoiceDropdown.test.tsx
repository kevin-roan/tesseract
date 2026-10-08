import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChoiceDropdown } from "./ChoiceDropdown";
import { PROJECT_CHOICES } from "./gallery-samples";
import { resolveChoice } from "./model";

describe("resolveChoice", () => {
  it("keeps an existing selection and falls back to the first option", () => {
    expect(resolveChoice(PROJECT_CHOICES, "tesseract")).toBe("tesseract");
    expect(resolveChoice(PROJECT_CHOICES, "gone")).toBe("all");
    expect(resolveChoice([], "gone")).toBeNull();
  });
});

describe("ChoiceDropdown", () => {
  it("shows the resolved label and fires onChange only for user picks of a new id", () => {
    const onChange = vi.fn();
    render(<ChoiceDropdown options={PROJECT_CHOICES} value="missing" onChange={onChange} tooltip="Filter by project" />);
    const trigger = screen.getByRole("button", { name: "Filter by project" });
    expect(trigger.textContent).toContain("All projects");
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(trigger);
    const list = screen.getByRole("listbox");
    expect(list).toBeTruthy();
    expect(screen.getByRole("option", { name: "All projects" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("option", { name: "All projects" }));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "hybrid-pos" }));
    expect(onChange).toHaveBeenCalledWith("hybrid-pos");
  });

  it("opens from the keyboard", () => {
    render(<ChoiceDropdown options={PROJECT_CHOICES} value="all" ariaLabel="Project" />);
    const trigger = screen.getByRole("button", { name: "Project" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });
  it("skips disabled options with the arrow keys", () => {
    const options = [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta", disabled: true },
      { id: "c", label: "Gamma" },
    ];
    render(<ChoiceDropdown options={options} value="a" ariaLabel="Letter" />);
    fireEvent.click(screen.getByRole("button", { name: "Letter" }));
    const alpha = screen.getByRole("option", { name: /Alpha/ });
    alpha.focus();
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("option", { name: /Gamma/ }));
  });
});
