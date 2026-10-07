import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TextField } from "./TextField";
import { TEXT_FIELD_LABELS } from "./labels";

describe("TextField", () => {
  it("emits values and submits on Enter", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    render(<TextField value="abc" onChange={onChange} onSubmit={onSubmit} aria-label="URL" />);
    const input = screen.getByRole("textbox", { name: "URL" });
    fireEvent.change(input, { target: { value: "abcd" } });
    expect(onChange).toHaveBeenCalledWith("abcd");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("abc");
  });

  it("masks passwords until revealed", () => {
    const { container } = render(<TextField value="secret" password aria-label="Token" />);
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: TEXT_FIELD_LABELS.show }));
    expect(input.type).toBe("text");
    expect(screen.getByRole("button", { name: TEXT_FIELD_LABELS.hide })).toBeTruthy();
  });

  it("marks errors as invalid", () => {
    render(<TextField value="x" error aria-label="Name" />);
    expect(screen.getByRole("textbox", { name: "Name" }).getAttribute("aria-invalid")).toBe("true");
  });
});
