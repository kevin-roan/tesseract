import { sampleHostAndroidStatus } from "@tesseract/protocol/fixtures";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { hostFixtureState } from "../../fixtures/host/data";
import { overrideIpcFixtures } from "../../fixtures/registry";
import { renderRoutes } from "../../test/render";
import DeviceWindow from "./DeviceWindow";

const android = { ...sampleHostAndroidStatus, emulator: { ...sampleHostAndroidStatus.emulator, state: "running" as const, serial: "emulator-5554", width: 1080, height: 2400 } };

describe("DeviceWindow", () => {
  let restore = () => undefined as void;
  afterEach(() => restore());

  function setup(sessionExpiresAt?: number | null) {
    const calls = { closed: 0, minimized: 0, fits: [] as { width: number; height: number }[] };
    restore = overrideIpcFixtures({
      hostShell: { state: () => hostFixtureState(sessionExpiresAt === undefined ? {} : { sessionExpiresAt }), androidStatus: () => android },
      window: {
        close: () => void (calls.closed += 1),
        minimize: () => void (calls.minimized += 1),
        fitDevice: (size) => void calls.fits.push(size),
      },
    });
    renderRoutes([{ path: "/device/:kind", element: <DeviceWindow /> }], "/device/android");
    return calls;
  }

  it("fits the window to the device and drives its window controls", async () => {
    const calls = setup();
    await waitFor(() => expect(calls.fits[0]).toEqual({ width: 1080, height: 2400 }));
    fireEvent.click(screen.getByRole("button", { name: "Minimize" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(calls).toMatchObject({ closed: 1, minimized: 1 }));
  });

  it("offers the keys that fit, without the volume keys", async () => {
    setup();
    expect(await screen.findByRole("button", { name: "Home" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save a screenshot" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Volume up" })).toBeNull();
  });

  it("gates on the host shell lock", async () => {
    setup(null);
    expect(await screen.findByText("The host shell is locked")).toBeTruthy();
  });
});
