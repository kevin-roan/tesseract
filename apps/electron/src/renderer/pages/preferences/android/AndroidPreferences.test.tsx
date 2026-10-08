import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSettingsFixture, settingsFixtures } from "../../../fixtures/app-settings/ipc";
import { overrideIpcFixtures } from "../../../fixtures/registry";
import { skipMotionDuringTests } from "../../../onboarding/shell/test-motion";
import { renderRoutes } from "../../../test/render";
import AndroidPreferences from "./AndroidPreferences";

const restores: (() => void)[] = [];

skipMotionDuringTests();

beforeEach(() => {
  resetSettingsFixture();
  restores.push(overrideIpcFixtures(settingsFixtures));
});

afterEach(() => {
  restores.splice(0).forEach((restore) => restore());
});

function render() {
  return renderRoutes([{ path: "*", element: <AndroidPreferences /> }], "/overview?preferences=android");
}

function rowOf(text: string): HTMLElement {
  return screen.getByText(text).closest("[class*=row]") as HTMLElement;
}

describe("AndroidPreferences", () => {
  it("lists the virtual devices and starts one", async () => {
    const startEmulator = vi.fn((_root: string, avd: string) => ({ kind: "running" as const, avd, serial: "emulator-5554" }));
    restores.push(overrideIpcFixtures({ android: { startEmulator } }));
    render();
    expect(await screen.findByText("Pixel_8_API_35")).toBeTruthy();
    fireEvent.click(within(rowOf("Tesseract_API_36")).getByRole("button", { name: "Start" }));
    await waitFor(() => expect(startEmulator).toHaveBeenCalledWith("/home/dev/Android/Sdk", "Tesseract_API_36"));
    expect(await within(rowOf("Tesseract_API_36")).findByText("Running")).toBeTruthy();
  });

  it("asks before deleting a device", async () => {
    const deleteAvd = vi.fn(() => undefined);
    restores.push(overrideIpcFixtures({ android: { deleteAvd } }));
    render();
    await screen.findByText("Pixel_8_API_35");
    fireEvent.click(within(rowOf("Pixel_8_API_35")).getByRole("button", { name: "Delete Pixel_8_API_35" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleteAvd).toHaveBeenCalledWith("/home/dev/Android/Sdk", "Pixel_8_API_35"));
  });

  it("shows why the emulator can't run", async () => {
    restores.push(overrideIpcFixtures({ android: { support: () => ({ supported: false, reason: "No emulator for this CPU" }) } }));
    render();
    expect(await screen.findByText("No emulator for this CPU")).toBeTruthy();
  });
});
