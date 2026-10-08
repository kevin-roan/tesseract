import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useToastStore } from "../Toast";
import { PAIR_SAMPLES } from "./gallery-samples";
import { PairDialog } from "./PairDialog";
import { skipMotionInTests } from "../DialogShell/skip-motion";

function setup(overrides: Partial<Parameters<typeof PairDialog>[0]> = {}) {
  const props = {
    onClose: vi.fn(),
    sandbox: PAIR_SAMPLES.sandbox,
    host: PAIR_SAMPLES.hostNoPin,
    onOpenPreferences: vi.fn(),
    onStartHost: vi.fn(),
    onRefreshHost: vi.fn(),
    onCopy: vi.fn(),
    onSavePin: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  render(<PairDialog {...props} />);
  return props;
}

afterEach(() => {
  useToastStore.setState({ queue: [] });
});


let restoreMotion: () => void;
beforeAll(() => {
  restoreMotion = skipMotionInTests();
});
afterAll(() => restoreMotion());

describe("PairDialog", () => {
  it("refreshes the host shell when opened and shows the sandbox panel", () => {
    const props = setup();
    expect(props.onRefreshHost).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("dialog-context").textContent).toBe("Sandbox");
    expect(screen.getByTestId("pair-qr")).toBeTruthy();
    expect(screen.getByText("Sandbox tesseract-sandbox · https://tesseract-sandbox.tail511d9d.ts.net")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Sandbox" }).getAttribute("aria-checked")).toBe("true");
  });

  it("switches to the host panel and updates the breadcrumb", () => {
    setup();
    fireEvent.click(screen.getByRole("radio", { name: "This computer" }));
    expect(screen.getByTestId("dialog-context").textContent).toBe("This computer");
    expect(screen.getByText("Host workstation · http://100.88.12.4:7701")).toBeTruthy();
    expect(screen.getByText("No PIN is set yet. Phones need it to unlock the shell.")).toBeTruthy();
  });

  it("copies the active link and toasts inside the dialog", async () => {
    const props = setup();
    fireEvent.click(screen.getAllByRole("button", { name: "Copy link" }).at(-1) as HTMLElement);
    await waitFor(() => expect(props.onCopy).toHaveBeenCalledWith(PAIR_SAMPLES.sandbox.link));
    expect(await screen.findByText("Pairing link copied")).toBeTruthy();
  });

  it("reports a failed copy instead of claiming success", async () => {
    setup({ onCopy: vi.fn(() => Promise.reject(new Error("denied"))) });
    fireEvent.click(screen.getAllByRole("button", { name: "Copy link" }).at(-1) as HTMLElement);
    expect(await screen.findByText("Couldn't copy the pairing link")).toBeTruthy();
    expect(screen.queryByText("Pairing link copied")).toBeNull();
  });

  it("disables Copy link when there is no link", () => {
    setup({ sandbox: PAIR_SAMPLES.unconfigured });
    const buttons = screen.getAllByRole("button", { name: "Copy link" });
    expect(buttons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Set up" }));
  });

  it("opens the Host PIN dialog on top and toasts in the pair dialog after saving", async () => {
    const props = setup({ initialTarget: "host" });
    fireEvent.click(screen.getByRole("button", { name: "Set PIN" }));
    const pin = await screen.findByLabelText("New PIN");
    fireEvent.change(pin, { target: { value: "123456" } });
    fireEvent.change(screen.getByLabelText("Repeat PIN"), { target: { value: "123456" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save PIN" }));
    });
    expect(props.onSavePin).toHaveBeenCalledWith("123456");
    expect(await screen.findByText("Host shell PIN saved")).toBeTruthy();
    expect(useToastStore.getState().queue[0]?.scope).toMatch(/^pair-dialog-/);
  });
});
