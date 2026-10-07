import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";
import { skipMotionInTests } from "../DialogShell/skip-motion";

const base = { heading: "Delete project?", body: "Gone for good.", confirmLabel: "Delete", cancelLabel: "Cancel" };


let restoreMotion: () => void;
beforeAll(() => {
  restoreMotion = skipMotionInTests();
});
afterAll(() => restoreMotion());

describe("ConfirmDialog", () => {
  it("focuses Cancel when destructive and closes before confirming", () => {
    const calls: string[] = [];
    render(<ConfirmDialog {...base} onClose={() => calls.push("close")} onConfirm={() => calls.push("confirm")} />);
    expect(screen.getByRole("alertdialog", { name: "Delete project?" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(calls).toEqual(["close", "confirm"]);
  });

  it("focuses Confirm when not destructive", () => {
    render(<ConfirmDialog {...base} destructive={false} onClose={() => undefined} onConfirm={() => undefined} />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Delete" }));
  });

  it("passes the chosen option and disables Confirm without options", () => {
    const onConfirm = vi.fn();
    const options = [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ];
    const { unmount } = render(<ConfirmDialog {...base} options={options} onClose={() => undefined} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete project?" }));
    fireEvent.click(screen.getByRole("option", { name: "B" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledWith("b");
    unmount();
    render(<ConfirmDialog {...base} options={[]} onClose={() => undefined} onConfirm={onConfirm} />);
    expect((screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
