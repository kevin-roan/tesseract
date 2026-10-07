import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { createAccelGuard } from "./accel-guard";
import { useAccelGuard, useAccelGuardActive } from "./use-accel-guard";
import { useFocusWithin } from "./use-focus-guard";

describe("useAccelGuard", () => {
  it("acquires while active and releases on change or unmount", () => {
    const guard = createAccelGuard();
    const { rerender, unmount } = renderHook(({ active }) => useAccelGuard(active, guard), { initialProps: { active: true } });
    expect(guard.active).toBe(true);
    rerender({ active: false });
    expect(guard.active).toBe(false);
    rerender({ active: true });
    unmount();
    expect(guard.count).toBe(0);
  });

  it("exposes the active flag reactively", () => {
    const guard = createAccelGuard();
    const { result } = renderHook(() => useAccelGuardActive(guard));
    expect(result.current).toBe(false);
    let release = () => undefined as void;
    act(() => {
      release = guard.acquire();
    });
    expect(result.current).toBe(true);
    act(() => release());
    expect(result.current).toBe(false);
  });
});

function FocusProbe() {
  const ref = useRef<HTMLDivElement | null>(null);
  const focused = useFocusWithin(ref);
  return (
    <div>
      <div ref={ref}>
        <button type="button">inside</button>
      </div>
      <button type="button">outside</button>
      <span data-testid="state">{focused ? "in" : "out"}</span>
    </div>
  );
}

describe("useFocusWithin", () => {
  it("tracks focus entering and leaving the element", () => {
    render(<FocusProbe />);
    const inside = screen.getByRole("button", { name: "inside" });
    act(() => inside.focus());
    expect(screen.getByTestId("state").textContent).toBe("in");
    fireEvent.focusOut(inside, { relatedTarget: screen.getByRole("button", { name: "outside" }) });
    expect(screen.getByTestId("state").textContent).toBe("out");
  });
});
