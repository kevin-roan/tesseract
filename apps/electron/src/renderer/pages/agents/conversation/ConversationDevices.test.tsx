import type { HostAndroidStatus, HostIosStatus } from "@tesseract/protocol";
import { sampleHostAndroidStatus, sampleHostIosStatus, sampleSimDevice } from "@tesseract/protocol/fixtures";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { hostFixtureState } from "../../../fixtures/host/data";
import { overrideIpcFixtures } from "../../../fixtures/registry";
import { renderRoutes } from "../../../test/render";
import { ConversationDevices } from "./ConversationDevices";

const androidRunning: HostAndroidStatus = { ...sampleHostAndroidStatus, emulator: { ...sampleHostAndroidStatus.emulator, state: "running", serial: "emulator-5554" } };
const androidStopped: HostAndroidStatus = { ...sampleHostAndroidStatus, emulator: { ...sampleHostAndroidStatus.emulator, state: "stopped", serial: null } };
const iosStopped: HostIosStatus = { ...sampleHostIosStatus, booted: null };
const iosBooted: HostIosStatus = { ...sampleHostIosStatus, booted: { ...sampleSimDevice, state: "booted" } };

describe("ConversationDevices", () => {
  let restore = () => undefined as void;
  afterEach(() => restore());

  function setup(android: HostAndroidStatus, ios: HostIosStatus) {
    const opened: string[] = [];
    restore = overrideIpcFixtures({
      hostShell: { state: () => hostFixtureState(), androidStatus: () => android, iosStatus: () => ios },
      window: { openDevice: (kind) => void opened.push(kind) },
    });
    renderRoutes([{ path: "/", element: <ConversationDevices projectId="expo-dummy" compact={false} /> }], "/");
    return opened;
  }

  it("stays hidden with no device and no run", async () => {
    setup(androidStopped, iosStopped);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Emulator" })).toBeNull());
  });

  it("opens the only running device straight away", async () => {
    const opened = setup(androidRunning, iosStopped);
    fireEvent.click(await screen.findByRole("button", { name: "Emulator" }));
    await waitFor(() => expect(opened).toEqual(["android"]));
  });

  it("asks which device when both are running", async () => {
    const opened = setup(androidRunning, iosBooted);
    await waitFor(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Emulator" }));
      fireEvent.click(await screen.findByRole("menuitem", { name: "iOS" }));
    });
    await waitFor(() => expect(opened).toEqual(["ios"]));
  });
});
