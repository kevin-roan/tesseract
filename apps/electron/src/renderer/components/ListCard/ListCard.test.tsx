import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ListCard } from "./ListCard";

describe("ListCard", () => {
  it("is static without onActivate", () => {
    render(<ListCard title="Alpha" subtitle="Next.js" value="3" valueLabel="running" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("running")).toBeTruthy();
  });

  it("activates when pressable", () => {
    const onActivate = vi.fn();
    render(<ListCard title="Alpha" onActivate={onActivate} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onActivate).toHaveBeenCalledOnce();
  });
});
