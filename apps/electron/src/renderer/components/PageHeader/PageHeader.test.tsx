import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("shows only the title on root pages", () => {
    const { container } = render(<PageHeader title="Overview" controls={false} />);
    expect(screen.getByText("Overview")).toBeTruthy();
    expect(container.querySelectorAll("svg")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("renders the parent breadcrumb and the back button", () => {
    const onBack = vi.fn();
    const onParentClick = vi.fn();
    render(<PageHeader title="tesseract" parent="Projects" onBack={onBack} onParentClick={onParentClick} controls={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onParentClick).toHaveBeenCalledOnce();
    expect(screen.getByText("tesseract")).toBeTruthy();
  });
});
