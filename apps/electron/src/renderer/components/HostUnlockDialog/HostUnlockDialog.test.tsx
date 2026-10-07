import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { HostUnlockDialog } from "./HostUnlockDialog";
import { skipMotionInTests } from "../DialogShell/skip-motion";

async function unlock(pin: string) {
  fireEvent.change(screen.getByLabelText("PIN"), { target: { value: pin } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
  });
}


let restoreMotion: () => void;
beforeAll(() => {
  restoreMotion = skipMotionInTests();
});
afterAll(() => restoreMotion());

describe("HostUnlockDialog", () => {
  it("renders the breadcrumb and subtitle", () => {
    render(<HostUnlockDialog onUnlock={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Unlock the host shell" })).toBeTruthy();
    expect(screen.getByText("Enter the host shell PIN to start the Android emulator")).toBeTruthy();
  });

  it("rejects invalid PINs", async () => {
    const onUnlock = vi.fn();
    render(<HostUnlockDialog onUnlock={onUnlock} onClose={vi.fn()} />);
    await unlock("abc");
    expect(screen.getByText("The PIN must be 6 to 12 digits")).toBeTruthy();
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it("closes and then calls onUnlocked", async () => {
    const calls: string[] = [];
    render(
      <HostUnlockDialog
        onUnlock={() => Promise.resolve()}
        onClose={() => calls.push("close")}
        onUnlocked={() => calls.push("unlocked")}
      />,
    );
    await unlock("123456");
    expect(calls).toEqual(["close", "unlocked"]);
  });

  it("shows the raw error text", async () => {
    render(<HostUnlockDialog onUnlock={() => Promise.reject(new Error("Wrong PIN"))} onClose={vi.fn()} />);
    await unlock("123456");
    expect(screen.getByText("Wrong PIN")).toBeTruthy();
  });
});
