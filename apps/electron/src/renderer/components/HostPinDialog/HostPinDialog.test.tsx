import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useToastStore } from "../Toast";
import { HostPinDialog } from "./HostPinDialog";
import { pinError } from "./pin";
import { skipMotionInTests } from "../DialogShell/skip-motion";

afterEach(() => {
  useToastStore.setState({ queue: [] });
});

async function fillAndSave(pin: string, repeat: string) {
  fireEvent.change(screen.getByLabelText("New PIN"), { target: { value: pin } });
  fireEvent.change(screen.getByLabelText("Repeat PIN"), { target: { value: repeat } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save PIN" }));
  });
}


let restoreMotion: () => void;
beforeAll(() => {
  restoreMotion = skipMotionInTests();
});
afterAll(() => restoreMotion());

describe("pinError", () => {
  it("validates digits and the repeat", () => {
    expect(pinError("12345", "12345")).toBe("pin");
    expect(pinError("12a456", "12a456")).toBe("pin");
    expect(pinError("1234567890123", "1234567890123")).toBe("pin");
    expect(pinError("123456", "123457")).toBe("repeat");
    expect(pinError("123456789012", "123456789012")).toBeNull();
  });
});

describe("HostPinDialog", () => {
  it("renders the spec layout", () => {
    render(<HostPinDialog onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Host shell PIN" })).toBeTruthy();
    expect(screen.getByTestId("dialog-context").textContent).toBe("This computer");
    expect(screen.getByText("6 to 12 digits")).toBeTruthy();
    expect(screen.getByText("Saving a new PIN ends every open phone session.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("New PIN"));
  });

  it("shows field errors and clears them on edit", async () => {
    const onSave = vi.fn();
    render(<HostPinDialog onSave={onSave} onClose={vi.fn()} />);
    await fillAndSave("12", "12");
    expect(screen.getByText("The PIN must be 6 to 12 digits")).toBeTruthy();
    expect(screen.getByLabelText("New PIN").getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(screen.getByLabelText("New PIN"), { target: { value: "123456" } });
    expect(screen.queryByText("The PIN must be 6 to 12 digits")).toBeNull();
    await fillAndSave("123456", "654321");
    expect(screen.getByText("The PINs do not match")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Repeat PIN"));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves, toasts in the given scope, then closes", async () => {
    const onSave = vi.fn(() => Promise.resolve());
    const onClose = vi.fn();
    render(<HostPinDialog onSave={onSave} onClose={onClose} toastScope="pair" />);
    await fillAndSave("123456", "123456");
    expect(onSave).toHaveBeenCalledWith("123456");
    expect(useToastStore.getState().queue).toMatchObject([{ message: "Host shell PIN saved", scope: "pair" }]);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the failure in the error notice and stays open", async () => {
    const onClose = vi.fn();
    render(<HostPinDialog onSave={() => Promise.reject(new Error("daemon offline"))} onClose={onClose} />);
    await fillAndSave("123456", "123456");
    expect(screen.getByText("Couldn't save the PIN: daemon offline")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
