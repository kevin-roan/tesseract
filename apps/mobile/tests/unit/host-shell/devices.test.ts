import { renderHook } from "@testing-library/react-native";
import type { TesseractClient } from "@tesseract/client";
import type { HostIosStatus } from "@tesseract/protocol";
import { sampleHostAndroidStatus, sampleHostIosStatus, sampleSimDevice } from "@tesseract/protocol/fixtures";

import { useHostNavigation } from "@/features/host-shell/hooks/use-host-navigation";
import { androidScreenName } from "@/features/host-shell/utils/android";
import { HOST_DEVICES, deviceKindFor, isHostDeviceKind, offersBothKinds, screenTargetFrom } from "@/features/host-shell/utils/devices";
import { parsePageMessage } from "@/features/sandbox/utils/web-bridge";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock("expo-router", () => ({
  get router() {
    return mockRouter;
  },
}));

beforeEach(() => Object.values(mockRouter).forEach((fn) => fn.mockClear()));

describe("host device kinds", () => {
  it("recognises android and ios only", () => {
    expect(isHostDeviceKind("android")).toBe(true);
    expect(isHostDeviceKind("ios")).toBe(true);
    expect(isHostDeviceKind("vnc")).toBe(false);
    expect(isHostDeviceKind(undefined)).toBe(false);
  });

  it("reads the screen to return to from route params", () => {
    expect(screenTargetFrom("android", "emulator-5556")).toEqual({ kind: "android", serial: "emulator-5556" });
    expect(screenTargetFrom("android", "")).toEqual({ kind: "android" });
    expect(screenTargetFrom("android", undefined)).toEqual({ kind: "android" });
    expect(screenTargetFrom("desktop", "x")).toBeNull();
    expect(screenTargetFrom("ios", sampleSimDevice.udid)).toEqual({ kind: "ios", serial: sampleSimDevice.udid });
  });

  it("offers both kinds once the host answers the ios status", () => {
    const unavailable: HostIosStatus = { ...sampleHostIosStatus, available: false, reasonCode: "no_idb" };
    expect(offersBothKinds(undefined)).toBe(false);
    expect(offersBothKinds(unavailable)).toBe(true);
    expect(deviceKindFor("ios", sampleHostAndroidStatus, undefined)).toBe("android");
    expect(deviceKindFor(null, sampleHostAndroidStatus, sampleHostIosStatus)).toBe("android");
    expect(deviceKindFor("ios", sampleHostAndroidStatus, unavailable)).toBe("ios");
    expect(deviceKindFor(null, { ...sampleHostAndroidStatus, available: false }, sampleHostIosStatus)).toBe("ios");
    expect(deviceKindFor(null, { ...sampleHostAndroidStatus, available: false }, unavailable)).toBe("android");
    expect(deviceKindFor(null, undefined, sampleHostIosStatus)).toBe("android");
  });

  it("builds the android page from the session client", async () => {
    const androidScreenPageUrl = jest.fn(async () => "http://host/ui/android");
    const client = { androidScreenPageUrl } as unknown as TesseractClient;
    await expect(HOST_DEVICES.android?.pageUrl(client, 1280, "emulator-5554")).resolves.toBe("http://host/ui/android");
    expect(androidScreenPageUrl).toHaveBeenCalledWith(1280, "emulator-5554");
  });

  it("builds the ios page from the session client with the picked UDID", async () => {
    const iosScreenPageUrl = jest.fn(async () => "http://host/ui/ios");
    const client = { iosScreenPageUrl } as unknown as TesseractClient;
    await expect(HOST_DEVICES.ios?.pageUrl(client, 1600, sampleSimDevice.udid)).resolves.toBe("http://host/ui/ios");
    expect(iosScreenPageUrl).toHaveBeenCalledWith(1600, sampleSimDevice.udid);
    expect(HOST_DEVICES.ios?.route).toBe("/host/ios");
  });

  it("accepts page messages from an ios screen page", () => {
    expect(parsePageMessage(JSON.stringify({ type: "ios-state", state: "connected" }), "ios")).toEqual({
      page: "ios",
      kind: "state",
      state: "connected",
    });
    expect(parsePageMessage(JSON.stringify({ type: "android-state", state: "connected" }), "ios")).toBeNull();
  });
});

describe("androidScreenName", () => {
  const status = sampleHostAndroidStatus;

  it("names a picked device that is not the host emulator", () => {
    const other = { ...status.devices[0]!, serial: "192.168.1.9:5555", hostEmulator: false, model: "Pixel 7" };
    expect(androidScreenName({ ...status, devices: [...status.devices, other] }, other.serial)).toBe("Pixel 7");
  });

  it("falls back to the host emulator's AVD", () => {
    expect(androidScreenName(status, undefined)).toBe(status.emulator.avd ?? undefined);
    expect(androidScreenName(undefined, undefined)).toBeUndefined();
  });
});

describe("useHostNavigation screens", () => {
  it("opens a device screen with or without a serial", async () => {
    const { result } = await renderHook(() => useHostNavigation());
    result.current.screen({ kind: "android" });
    expect(mockRouter.push).toHaveBeenLastCalledWith("/host/android");
    result.current.screen({ kind: "android", serial: "emulator-5556" });
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: "/host/android", params: { serial: "emulator-5556" } });
    result.current.replaceWithScreen({ kind: "android", serial: "emulator-5556" });
    expect(mockRouter.replace).toHaveBeenLastCalledWith({ pathname: "/host/android", params: { serial: "emulator-5556" } });
  });

  it("opens the ios screen with the picked UDID", async () => {
    const { result } = await renderHook(() => useHostNavigation());
    result.current.screen({ kind: "ios" });
    expect(mockRouter.push).toHaveBeenLastCalledWith("/host/ios");
    result.current.screen({ kind: "ios", serial: sampleSimDevice.udid });
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: "/host/ios", params: { serial: sampleSimDevice.udid } });
    result.current.unlockForScreen({ kind: "ios", serial: sampleSimDevice.udid });
    expect(mockRouter.replace).toHaveBeenLastCalledWith({ pathname: "/host", params: { next: "ios", serial: sampleSimDevice.udid } });
  });

  it("keeps the device and serial across the unlock screen", async () => {
    const { result } = await renderHook(() => useHostNavigation());
    result.current.unlockForScreen({ kind: "android", serial: "emulator-5556" });
    expect(mockRouter.replace).toHaveBeenLastCalledWith({ pathname: "/host", params: { next: "android", serial: "emulator-5556" } });
    result.current.unlockForScreen({ kind: "android" });
    expect(mockRouter.replace).toHaveBeenLastCalledWith({ pathname: "/host", params: { next: "android" } });
  });
});
