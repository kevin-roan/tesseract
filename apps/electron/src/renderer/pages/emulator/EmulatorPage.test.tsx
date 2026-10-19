import type { HostAndroidStatus, HostIosStatus } from "@tesseract/protocol";
import { sampleHostAndroidStatus, sampleHostIosStatus, sampleSimDevice } from "@tesseract/protocol/fixtures";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmulatorStopSignal, HostShellState } from "../../../shared/contracts/hostShell";
import { hostFixtureState } from "../../fixtures/host/data";
import { overrideIpcFixtures } from "../../fixtures/registry";
import { renderRoutes } from "../../test/render";
import EmulatorPage from "./EmulatorPage";

let host: HostShellState;
let android: HostAndroidStatus;
let ios: HostIosStatus;
const stops: (EmulatorStopSignal | undefined)[] = [];
const starts: string[] = [];

const withSim = (state: HostIosStatus["devices"][number]["state"]): HostIosStatus => {
  const device = { ...sampleSimDevice, state };
  return { ...sampleHostIosStatus, devices: [device], booted: state === "booted" ? device : null };
};

const withState = (state: HostAndroidStatus["emulator"]["state"]): HostAndroidStatus => ({
  ...sampleHostAndroidStatus,
  emulator: { ...sampleHostAndroidStatus.emulator, state, avd: "Pixel_8_API_35", serial: state === "running" ? "127.0.0.1:41555" : null },
});

function renderPage() {
  return renderRoutes([{ path: "/:pageId/*", element: <EmulatorPage /> }], "/emulator");
}

describe("EmulatorPage", () => {
  let restore: () => void;
  beforeEach(() => {
    host = hostFixtureState();
    android = withState("running");
    ios = withSim("shutdown");
    restore = overrideIpcFixtures({
      hostShell: {
        iosStatus: () => ios,
        bootSimulator: (udid) => {
          starts.push(udid);
          ios = withSim("booting");
          return ios;
        },
        shutdownSimulator: (signal) => {
          stops.push(signal);
          ios = withSim("shutdown");
          return ios;
        },
        state: () => host,
        androidStatus: () => android,
        startEmulator: (avd) => {
          starts.push(avd);
          android = withState("starting");
          return android;
        },
        stopEmulator: (signal) => {
          stops.push(signal);
          android = withState("stopped");
          return android;
        },
      },
    });
  });
  afterEach(() => {
    restore();
    stops.length = 0;
    starts.length = 0;
  });

  it("stops or force-kills a running emulator", async () => {
    renderPage();
    expect(await screen.findByText("Running")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Force kill" }));
    await waitFor(() => expect(stops).toEqual(["SIGKILL"]));
    expect(await screen.findByText("The emulator is off")).toBeTruthy();
  });

  it("stops gracefully with SIGTERM", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Stop" }));
    await waitFor(() => expect(stops).toEqual(["SIGTERM"]));
  });

  it("starts the picked virtual device", async () => {
    android = withState("stopped");
    renderPage();
    await screen.findByText("Stopped");
    const start = screen.getByRole("button", { name: "Start" }) as HTMLButtonElement;
    await waitFor(() => expect(start.disabled).toBe(false));
    fireEvent.click(start);
    await waitFor(() => expect(starts).toEqual(["Pixel_8_API_35"]));
    expect(await screen.findByText("Booting the emulator…")).toBeTruthy();
  });

  it("shows the device keys", async () => {
    renderPage();
    await screen.findByText("Running");
    expect(screen.getByRole("button", { name: "Home" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  });

  it("gates on the host shell lock", async () => {
    host = hostFixtureState({ sessionExpiresAt: null });
    renderPage();
    expect(await screen.findByText("The host shell is locked")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Force kill" })).toBeNull();
  });

  it("boots and force-kills an iOS simulator", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("radio", { name: "iOS" }));
    await screen.findByText("The simulator is off");
    const boot = screen.getByRole("button", { name: "Start" }) as HTMLButtonElement;
    await waitFor(() => expect(boot.disabled).toBe(false));
    fireEvent.click(boot);
    await waitFor(() => expect(starts).toEqual([sampleSimDevice.udid]));
    expect(await screen.findByText("Booting the simulator…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Force kill" }));
    await waitFor(() => expect(stops).toEqual(["SIGKILL"]));
    expect(await screen.findByText("The simulator is off")).toBeTruthy();
  });

  it("explains why the iOS Simulator is unavailable", async () => {
    ios = { ...sampleHostIosStatus, available: false, reason: "not a Mac", reasonCode: "not_macos", devices: [], booted: null };
    renderPage();
    fireEvent.click(await screen.findByRole("radio", { name: "iOS" }));
    expect(await screen.findByText("No iOS Simulator on this host")).toBeTruthy();
    expect(screen.getByText(/needs a Mac/)).toBeTruthy();
  });
});
