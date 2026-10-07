import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResizeHandle } from "./ResizeHandle";

const handle = () => screen.getByRole("separator");

describe("ResizeHandle", () => {
  it("resizes while dragging and commits on release", () => {
    const onResize = vi.fn();
    const onCommit = vi.fn();
    render(<ResizeHandle width={244} zoom={1} onResize={onResize} onCommit={onCommit} />);
    fireEvent.pointerDown(handle(), { button: 0, pointerId: 1, clientX: 100 });
    expect(handle().getAttribute("data-dragging")).toBe("true");
    expect(document.body.style.userSelect).toBe("none");
    expect(document.body.style.cursor).toBe("col-resize");
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 150 });
    expect(onResize).toHaveBeenLastCalledWith(294);
    fireEvent.pointerUp(handle(), { pointerId: 1, clientX: 150 });
    expect(onCommit).toHaveBeenCalledWith(294);
    expect(handle().getAttribute("data-dragging")).toBeNull();
    expect(document.body.style.userSelect).toBe("");
  });

  it("ignores moves without a drag and from other pointers", () => {
    const onResize = vi.fn();
    render(<ResizeHandle width={244} onResize={onResize} onCommit={vi.fn()} />);
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 150 });
    fireEvent.pointerDown(handle(), { button: 0, pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(handle(), { pointerId: 2, clientX: 300 });
    expect(onResize).not.toHaveBeenCalled();
  });

  it("resets on double-click and Enter, steps with arrows", () => {
    const onResize = vi.fn();
    const onCommit = vi.fn();
    render(<ResizeHandle width={300} onResize={onResize} onCommit={onCommit} />);
    fireEvent.doubleClick(handle());
    expect(onCommit).toHaveBeenLastCalledWith(244);
    fireEvent.keyDown(handle(), { key: "ArrowLeft" });
    expect(onCommit).toHaveBeenLastCalledWith(292);
    fireEvent.keyDown(handle(), { key: "Enter" });
    expect(onResize).toHaveBeenLastCalledWith(244);
  });

  it("is hidden when collapsed", () => {
    render(<ResizeHandle width={300} hidden onResize={vi.fn()} onCommit={vi.fn()} />);
    expect(screen.queryByRole("separator")).toBeNull();
  });
});
