import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Row } from "./Row";

describe("Row", () => {
  it("is not focusable without onActivate", () => {
    const { container } = render(<Row>plain</Row>);
    const row = container.firstElementChild as HTMLElement;
    expect(row.hasAttribute("tabindex")).toBe(false);
    expect(row.className).not.toContain("activatable");
  });

  it("activates on click, Enter and Space", () => {
    const onActivate = vi.fn();
    const { container } = render(<Row onActivate={onActivate}>row</Row>);
    const row = container.firstElementChild as HTMLElement;
    expect(row.tabIndex).toBe(0);
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });
    fireEvent.keyDown(row, { key: "a" });
    expect(onActivate).toHaveBeenCalledTimes(3);
  });

  it("ignores clicks and keys from nested controls", () => {
    const onActivate = vi.fn();
    const onCopy = vi.fn();
    render(
      <Row onActivate={onActivate} hoverActions={<button onClick={onCopy}>Copy</button>}>
        row
      </Row>,
    );
    const button = screen.getByRole("button", { name: "Copy" });
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: "Enter" });
    expect(onCopy).toHaveBeenCalledOnce();
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("marks the selected row", () => {
    const { container } = render(<Row selected>row</Row>);
    expect(container.firstElementChild?.hasAttribute("data-selected")).toBe(true);
  });
});
