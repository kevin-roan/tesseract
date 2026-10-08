import type { HostAndroidStatus } from "@tesseract/protocol";
import { sampleAndroidLink, sampleEmulator, sampleHostAndroidStatus } from "@tesseract/protocol/fixtures";

import {
  androidPollInterval,
  androidScreenMaxSize,
  canStartEmulator,
  canStopEmulator,
  deviceLabel,
  deviceMeta,
  emulatorMeta,
  isEmulatorUnisolated,
  isLinkedTo,
  isolationNotice,
  linkBadge,
  linkBlockedReason,
  pickAvd,
  pickDevice,
  streamableDevices,
} from "@/features/host-shell/utils/android";
import { ANDROID_LINK_POLL_INTERVAL_MS, ANDROID_POLL_INTERVAL_MS, ANDROID_SCREEN_MAX_SIZE } from "@/features/host-shell/utils/constants";
import { ANDROID_COPY } from "@/features/host-shell/utils/content";

const stopped: HostAndroidStatus = {
  ...sampleHostAndroidStatus,
  avds: ["Pixel_8_API_35", "Tablet_API_34"],
  emulator: { ...sampleEmulator, state: "stopped", avd: null, serial: null, width: null, height: null, startedAt: null },
};

describe("android device helpers", () => {
  const [emulator, genymotion] = sampleHostAndroidStatus.devices;
  const offline = { serial: "R5CT20ABCDE", state: "unauthorized", kind: "usb" as const, model: null, hostEmulator: false };
  const status: HostAndroidStatus = { ...sampleHostAndroidStatus, devices: [offline, ...sampleHostAndroidStatus.devices] };

  it("streams only ready devices and prefers the pick, then the host default, then the host emulator", () => {
    expect(streamableDevices(status)).toEqual([emulator, genymotion]);
    expect(pickDevice(status, "192.168.56.101:5555")).toEqual(genymotion);
    expect(pickDevice(status, "R5CT20ABCDE")).toEqual(emulator);
    expect(pickDevice({ ...status, stream: { ...status.stream, device: "192.168.56.101:5555" } }, null)).toEqual(genymotion);
    expect(pickDevice({ ...status, devices: [offline] }, null)).toBeNull();
    expect(pickDevice(undefined, null)).toBeNull();
  });

  it("labels a device by model and kind", () => {
    expect(deviceLabel(genymotion!)).toBe("Google Pixel 3");
    expect(deviceLabel(offline)).toBe("R5CT20ABCDE");
    expect(deviceMeta(genymotion!)).toBe("Genymotion · 192.168.56.101:5555");
  });
});

describe("android status helpers", () => {
  it("polls fast while the emulator boots or stops or the link dials, and slowly while a link exists", () => {
    expect(androidPollInterval(undefined)).toBe(false);
    expect(androidPollInterval({ ...stopped, link: { ...sampleAndroidLink, configured: false, connected: false } })).toBe(false);
    expect(androidPollInterval(sampleHostAndroidStatus)).toBe(ANDROID_LINK_POLL_INTERVAL_MS);
    expect(androidPollInterval({ ...stopped, emulator: { ...stopped.emulator, state: "starting" } })).toBe(ANDROID_POLL_INTERVAL_MS);
    expect(androidPollInterval({ ...stopped, emulator: { ...stopped.emulator, state: "stopping" } })).toBe(ANDROID_POLL_INTERVAL_MS);
    expect(androidPollInterval({ ...stopped, link: { ...sampleAndroidLink, connected: false } })).toBe(ANDROID_POLL_INTERVAL_MS);
    expect(androidPollInterval({ ...stopped, link: { ...sampleAndroidLink, connected: false, lastError: "refused" } })).toBe(
      ANDROID_LINK_POLL_INTERVAL_MS,
    );
  });

  it("picks the chosen AVD, else the emulator's, else the first", () => {
    expect(pickAvd(undefined, null)).toBeNull();
    expect(pickAvd(stopped, "Tablet_API_34")).toBe("Tablet_API_34");
    expect(pickAvd(stopped, "Gone")).toBe("Pixel_8_API_35");
    expect(pickAvd({ ...stopped, emulator: { ...stopped.emulator, avd: "Tablet_API_34" } }, null)).toBe("Tablet_API_34");
    expect(pickAvd({ ...stopped, avds: [] }, null)).toBeNull();
  });

  it("starts only a stopped or failed emulator with an AVD, stops a live one", () => {
    expect(canStartEmulator(stopped, "Pixel_8_API_35")).toBe(true);
    expect(canStartEmulator(stopped, null)).toBe(false);
    expect(canStartEmulator({ ...stopped, available: false }, "Pixel_8_API_35")).toBe(false);
    expect(canStartEmulator(sampleHostAndroidStatus, "Pixel_8_API_35")).toBe(false);
    expect(canStopEmulator("running")).toBe(true);
    expect(canStopEmulator("starting")).toBe(true);
    expect(canStopEmulator("stopped")).toBe(false);
  });

  it("matches the link to the active sandbox ignoring a trailing slash and case", () => {
    expect(isLinkedTo(sampleAndroidLink, "http://100.64.0.2:7700/")).toBe(true);
    expect(isLinkedTo(sampleAndroidLink, "http://100.64.0.3:7700")).toBe(false);
    expect(isLinkedTo({ ...sampleAndroidLink, configured: false }, "http://100.64.0.2:7700")).toBe(false);
    expect(isLinkedTo(sampleAndroidLink, null)).toBe(false);
  });

  it("labels the link state", () => {
    expect(linkBadge(sampleAndroidLink)).toEqual({ label: "Connected", tone: "success" });
    expect(linkBadge({ ...sampleAndroidLink, connected: false })).toEqual({ label: "Connecting", tone: "warning" });
    expect(linkBadge({ ...sampleAndroidLink, connected: false, lastError: "x" })).toEqual({ label: "Disconnected", tone: "danger" });
    expect(linkBadge({ ...sampleAndroidLink, configured: false })).toEqual({ label: "Not linked", tone: "neutral" });
  });

  it("describes the emulator", () => {
    expect(emulatorMeta(sampleEmulator)).toBe("127.0.0.1:41555 · 1080×2400 · isolated");
    expect(emulatorMeta({ ...sampleEmulator, serial: "emulator-5554", managed: false, isolated: false })).toBe(
      "emulator-5554 · 1080×2400 · adopted · not isolated",
    );
    expect(emulatorMeta(stopped.emulator)).toBeUndefined();
  });

  it("blocks the link and warns while a live emulator is not isolated", () => {
    const plain: HostAndroidStatus = { ...sampleHostAndroidStatus, emulator: { ...sampleEmulator, managed: false, isolated: false } };
    expect(isEmulatorUnisolated(sampleEmulator)).toBe(false);
    expect(isEmulatorUnisolated(plain.emulator)).toBe(true);
    expect(isEmulatorUnisolated(stopped.emulator)).toBe(false);
    expect(linkBlockedReason(undefined)).toBeNull();
    expect(linkBlockedReason(sampleHostAndroidStatus)).toBeNull();
    expect(linkBlockedReason(stopped)).toBeNull();
    expect(linkBlockedReason(plain)).toBe(ANDROID_COPY.linkBlocked);
    expect(isolationNotice(sampleHostAndroidStatus)).toBeNull();
    expect(isolationNotice(plain)).toEqual({ title: ANDROID_COPY.notIsolatedTitle, message: ANDROID_COPY.notIsolated });
    expect(isolationNotice({ ...stopped, isolation: "none" })).toEqual({ title: ANDROID_COPY.isolationOffTitle, message: ANDROID_COPY.isolationOff });
  });

  it("caps the streamed screen size", () => {
    expect(androidScreenMaxSize(390, 844, 3)).toBe(ANDROID_SCREEN_MAX_SIZE);
    expect(androidScreenMaxSize(320, 480, 2)).toBe(960);
  });
});
