import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEARCH_FIELD_LABELS } from "./labels";
import { SearchField } from "./SearchField";

function Harness({ onSearch, onStop }: { onSearch?(value: string): void; onStop?(): void }) {
  const [value, setValue] = useState("");
  return <SearchField value={value} onChange={setValue} onSearch={onSearch} onStop={onStop} placeholder="Search projects" />;
}

describe("SearchField", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces search and clears with the clear button", () => {
    const onSearch = vi.fn();
    render(<Harness onSearch={onSearch} />);
    const input = screen.getByRole("searchbox", { name: "Search projects" });
    fireEvent.change(input, { target: { value: "mono" } });
    expect(onSearch).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onSearch).toHaveBeenLastCalledWith("mono");
    fireEvent.click(screen.getByRole("button", { name: SEARCH_FIELD_LABELS.clear }));
    expect((input as HTMLInputElement).value).toBe("");
    expect(onSearch).toHaveBeenLastCalledWith("");
  });

  it("clears on Escape, then stops on a second Escape", () => {
    const onStop = vi.fn();
    render(<Harness onStop={onStop} />);
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "x" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect((input as HTMLInputElement).value).toBe("");
    expect(onStop).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
