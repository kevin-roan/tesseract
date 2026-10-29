import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSettingsFixture, settingsFixtures } from "../../../fixtures/app-settings/ipc";
import { hostFixtureState, hostProxyFixture, resetHostToolchainFixture } from "../../../fixtures/host/data";
import { overrideIpcFixtures } from "../../../fixtures/registry";
import { skipMotionDuringTests } from "../../../onboarding/shell/test-motion";
import { renderRoutes } from "../../../test/render";
import AndroidPreferences from "./AndroidPreferences";

const restores: (() => void)[] = [];

skipMotionDuringTests();

beforeEach(() => {
  resetSettingsFixture();
  resetHostToolchainFixture();
  restores.push(overrideIpcFixtures(settingsFixtures));
  restores.push(overrideIpcFixtures({ masterHost: { state: () => ({ kind: "local" }) } }));
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

  it("edits the connected host's SDK and JDK when the sandbox runs on another computer", async () => {
    const request = vi.fn((_id: string, req: Parameters<typeof hostProxyFixture>[0]) => hostProxyFixture(req));
    const startEmulator = vi.fn();
    restores.push(
      overrideIpcFixtures({
        masterHost: { state: () => ({ kind: "linked", sandboxUrl: "http://100.64.0.9:7700", host: { link: "tesseract://host", url: "http://100.64.0.9:7701", name: "macbook", online: true } }) },
        hostShell: { state: () => hostFixtureState({ status: "external", pairing: { link: "tesseract://host", url: "http://127.0.0.1:7701", name: "macbook", pinSet: true } }), request },
        android: { startEmulator },
      }),
    );
    render();
    expect(await screen.findByText("Android settings of macbook")).toBeTruthy();
    expect(await screen.findByText("Found on the host · /Users/me/Library/Android/sdk")).toBeTruthy();

    const sdkGroup = screen.getByRole("radiogroup", { name: "Android SDK" });
    fireEvent.click(within(sdkGroup).getByText("Another folder"));
    fireEvent.change(screen.getByLabelText("Folder"), { target: { value: "/opt/android" } });
    fireEvent.click(within(sdkGroup.closest("section") ?? document.body).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(request.mock.calls.some(([, req]) => req.method === "PUT" && req.body === JSON.stringify({ androidSdkRoot: "/opt/android" }))).toBe(true));
    expect(startEmulator).not.toHaveBeenCalled();
  });
});
