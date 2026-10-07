import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectionDot } from "../ConnectionDot";
import { IconBadge } from "../IconBadge";
import { ListToolbar, ToolbarToggle } from "../ListToolbar";
import { Chip } from "./Chip";
import { ChipGroup } from "./ChipGroup";

const OPTIONS = [
  { id: "a", label: "A", disabled: true },
  { id: "b", label: "B" },
  { id: "c", label: "C" },
];

describe("Chip", () => {
  it("exposes toggle and radio semantics", () => {
    const { rerender } = render(<Chip label="Shared" selected />);
    expect(screen.getByRole("button", { name: "Shared" }).getAttribute("aria-pressed")).toBe("true");
    rerender(<Chip label="Shared" kind="radio" />);
    expect(screen.getByRole("radio", { name: "Shared" }).getAttribute("aria-checked")).toBe("false");
  });
});

describe("ChipGroup", () => {
  it("fires onChange only for a new selection and never deselects", () => {
    const onChange = vi.fn();
    render(<ChipGroup options={OPTIONS} value="b" onChange={onChange} ariaLabel="Range" />);
    fireEvent.click(screen.getByRole("radio", { name: "B" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: "C" }));
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("roves over enabled chips with the arrow keys", () => {
    const onChange = vi.fn();
    render(<ChipGroup options={OPTIONS} value="c" onChange={onChange} ariaLabel="Range" />);
    expect(screen.getByRole("radio", { name: "C" }).tabIndex).toBe(0);
    expect(screen.getByRole("radio", { name: "B" }).tabIndex).toBe(-1);
    fireEvent.keyDown(screen.getByRole("radiogroup", { name: "Range" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("b");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "B" }));
  });
});

describe("list toolbar widgets", () => {
  it("renders start and end slots with a pressed toggle", () => {
    const onToggle = vi.fn();
    render(<ListToolbar start={<span>Tabs</span>} end={<ToolbarToggle icon="filter" label="Search projects" active={false} onToggle={onToggle} />} />);
    const toggle = screen.getByRole("button", { name: "Search projects" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("renders an icon badge and a connection dot with its label", () => {
    render(
      <>
        <IconBadge icon="projects" label="Project" size="large" />
        <ConnectionDot tone="success" label="Connected" live />
      </>,
    );
    expect(screen.getByRole("img", { name: "Project" }).className).toContain("large");
    expect(screen.getByText("Connected")).toBeTruthy();
  });
});
