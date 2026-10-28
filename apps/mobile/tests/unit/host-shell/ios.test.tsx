import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import { HostShellClient } from "@tesseract/client";
import type { HostIosStatus, SimDevice } from "@tesseract/protocol";
import { sampleHostIosStatus, sampleSimDevice } from "@tesseract/protocol/fixtures";

import HostIos from "@/features/host-shell/components/host-ios";
import { useHostIos, type HostIosState } from "@/features/host-shell/hooks/use-host-ios";
import { useHostSessionStore } from "@/features/host-shell/store/host-session-store";
import { useHostStore } from "@/features/host-shell/store/host-store";
import { IOS_POLL_INTERVAL_MS } from "@/features/host-shell/utils/constants";
import { IOS_COPY, SIMULATOR_KILL_CONFIRM } from "@/features/host-shell/utils/content";
import {
  canBootSim,
  canKillSim,
  canShutdownSim,
  iosPollInterval,
  iosScreenName,
  iosUnavailableNotice,
  liveDevice,
  otherBootedReason,
  pickSimDevice,
  simMeta,
  simOptionMeta,
  withDevice,
} from "@/features/host-shell/utils/ios";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";
import { confirm } from "@/lib/confirm";

import { createTestQueryClient, createWrapper } from "../sandbox/helpers";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock("expo-router", () => ({
  get router() {
    return mockRouter;
  },
}));
jest.mock("@/lib/confirm", () => ({ confirm: jest.fn() }));
jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), HostShellClient: jest.fn() }));

const ipad = sampleHostIosStatus.devices[1]!;
const shutDown: HostIosStatus = {
  ...sampleHostIosStatus,
  booted: null,
  devices: sampleHostIosStatus.devices.map((device) => ({ ...device, state: "shutdown" })),
};

describe("ios helpers", () => {
  it("finds the live device and polls only while one boots or shuts down", () => {
    expect(liveDevice(sampleHostIosStatus)).toEqual(sampleSimDevice);
    expect(liveDevice(shutDown)).toBeNull();
    expect(liveDevice({ ...shutDown, devices: [{ ...ipad, state: "shutting_down" }] })?.udid).toBe(ipad.udid);
    expect(iosPollInterval(undefined)).toBe(false);
    expect(iosPollInterval(sampleHostIosStatus)).toBe(false);
    expect(iosPollInterval({ ...shutDown, devices: [{ ...ipad, state: "booting" }] })).toBe(IOS_POLL_INTERVAL_MS);
  });

  it("prefers the pick, then the live device, then the first one", () => {
    expect(pickSimDevice(sampleHostIosStatus, ipad.udid)).toEqual(ipad);
    expect(pickSimDevice(sampleHostIosStatus, "gone")).toEqual(sampleSimDevice);
    expect(pickSimDevice(shutDown, null)?.udid).toBe(sampleSimDevice.udid);
    expect(pickSimDevice(undefined, null)).toBeNull();
  });

  it("boots one device at a time", () => {
    expect(canBootSim(shutDown, shutDown.devices[1]!)).toBe(true);
    expect(canBootSim(sampleHostIosStatus, ipad)).toBe(false);
    expect(canBootSim(sampleHostIosStatus, sampleSimDevice)).toBe(false);
    expect(canBootSim({ ...shutDown, available: false }, shutDown.devices[0]!)).toBe(false);
    expect(canBootSim(shutDown, null)).toBe(false);
    expect(otherBootedReason(sampleHostIosStatus, ipad)).toBe(IOS_COPY.otherBooted(sampleSimDevice.name));
    expect(otherBootedReason(sampleHostIosStatus, sampleSimDevice)).toBeNull();
  });

  it("shuts down a booting or booted device and kills any live one", () => {
    const at = (state: SimDevice["state"]): SimDevice => ({ ...sampleSimDevice, state });
    expect(canShutdownSim(at("booted"))).toBe(true);
    expect(canShutdownSim(at("booting"))).toBe(true);
    expect(canShutdownSim(at("shutting_down"))).toBe(false);
    expect(canKillSim(at("shutting_down"))).toBe(true);
    expect(canKillSim(at("shutdown"))).toBe(false);
    expect(canKillSim(null)).toBe(false);
  });

  it("explains each unavailable reason, preferring the host's own words", () => {
    expect(iosUnavailableNotice(sampleHostIosStatus)).toBeNull();
    for (const code of ["disabled", "not_macos", "no_xcode", "no_idb"] as const) {
      const notice = iosUnavailableNotice({ ...shutDown, available: false, reasonCode: code, reason: null });
      expect(notice).toEqual(IOS_COPY.unavailableReasons[code]);
    }
    expect(iosUnavailableNotice({ ...shutDown, available: false, reasonCode: "no_idb", reason: "idb missing" })).toEqual({
      title: IOS_COPY.unavailableReasons.no_idb.title,
      message: "idb missing",
    });
  });

  it("describes devices and names the streamed one", () => {
    expect(simMeta(sampleSimDevice)).toBe("iOS 26.0 · 402×874 pt · @3x");
    expect(simMeta(ipad)).toBe("iOS 26.0");
    expect(simOptionMeta(ipad)).toBe("iOS 26.0 · Shut down");
    expect(iosScreenName(sampleHostIosStatus, ipad.udid)).toBe(ipad.name);
    expect(iosScreenName(sampleHostIosStatus, undefined)).toBe(sampleSimDevice.name);
    expect(iosScreenName(undefined, undefined)).toBeUndefined();
  });

  it("folds a booted or shut down device into the status", () => {
    const booting: SimDevice = { ...ipad, state: "booting" };
    expect(withDevice(shutDown, booting).booted).toEqual(booting);
    expect(withDevice(shutDown, booting).devices[1]).toEqual(booting);
    const off: SimDevice = { ...sampleSimDevice, state: "shutdown" };
    expect(withDevice(sampleHostIosStatus, off).booted).toBeNull();
    expect(withDevice(sampleHostIosStatus, { ...ipad, state: "failed" }).booted).toEqual(sampleSimDevice);
  });
});

const iosState = (status: HostIosStatus | undefined, overrides: Partial<HostIosState> = {}): HostIosState => ({
  status,
  supported: true,
  loading: false,
  error: null,
  refresh: jest.fn(),
  unavailable: status ? iosUnavailableNotice(status) : null,
  device: pickSimDevice(status, null),
  devicePicker: { visible: false, options: [], open: jest.fn(), close: jest.fn(), select: jest.fn() },
  blocked: null,
  canBoot: false,
  canShutdown: true,
  canKill: true,
  canOpen: true,
  boot: jest.fn(),
  booting: false,
  shutdown: jest.fn(),
  shuttingDown: false,
  kill: jest.fn(),
  killing: false,
  openScreen: jest.fn(),
  openStreamSettings: jest.fn(),
  ...overrides,
});

describe("HostIos", () => {
  it("drives a booted simulator", async () => {
    const ios = iosState(sampleHostIosStatus);
    await render(<HostIos ios={ios} />);

    expect(screen.getAllByText(sampleSimDevice.name).length).toBeGreaterThan(0);
    expect(screen.getByText("Booted")).toBeOnTheScreen();
    expect(screen.getByText("Simulator · Xcode 26.0")).toBeOnTheScreen();
    expect(screen.queryByText(IOS_COPY.boot)).toBeNull();
    await fireEvent.press(screen.getByText(IOS_COPY.openScreen));
    expect(ios.openScreen).toHaveBeenCalled();
    await fireEvent.press(screen.getByText(IOS_COPY.shutdown));
    expect(ios.shutdown).toHaveBeenCalled();
    await fireEvent.press(screen.getByText(IOS_COPY.forceKill));
    expect(ios.kill).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("host-ios-stream-settings"));
    expect(ios.openStreamSettings).toHaveBeenCalled();
  });

  it("offers boot for a shut down device", async () => {
    const ios = iosState(shutDown, { canBoot: true, canShutdown: false, canKill: false, canOpen: false });
    await render(<HostIos ios={ios} />);

    await fireEvent.press(screen.getByText(IOS_COPY.boot));
    expect(ios.boot).toHaveBeenCalled();
    expect(screen.queryByText(IOS_COPY.forceKill)).toBeNull();
    expect(screen.queryByText(IOS_COPY.openScreen)).toBeNull();
  });

  it("shows why the simulator is unavailable instead of the device card", async () => {
    const status: HostIosStatus = { ...shutDown, available: false, reasonCode: "no_idb", reason: null, devices: [] };
    await render(<HostIos ios={iosState(status)} />);

    expect(screen.getByText(IOS_COPY.unavailableReasons.no_idb.title)).toBeOnTheScreen();
    expect(screen.queryByText(IOS_COPY.boot)).toBeNull();
    expect(screen.queryByText(IOS_COPY.openScreen)).toBeNull();
  });
});

describe("useHostIos", () => {
  const mockConfirm = confirm as jest.Mock;
  const MockClient = HostShellClient as unknown as jest.Mock;
  const session = { hostIosStatus: jest.fn(), bootSimulator: jest.fn(), shutdownSimulator: jest.fn() };
  const HOST = { name: "Mac", baseUrl: "http://100.64.0.9:7701", addedAt: "2026-10-03T10:00:00.000Z" };

  beforeEach(() => {
    for (const fn of Object.values(session)) fn.mockReset();
    mockConfirm.mockReset();
    mockRouter.push.mockClear();
    MockClient.mockReset().mockImplementation(() => ({ sessionClient: () => session }));
    useSandboxStore.setState({ activeId: "sbx_a", hydrated: true });
    useHostStore.setState({ hosts: { sbx_a: HOST }, tokens: { sbx_a: `token-${Math.random()}` }, hydrated: true });
    useHostSessionStore.setState({ current: { session: `hss_${Math.random()}`, expiresAt: new Date(Date.now() + 600_000).toISOString() } });
  });

  afterEach(() => useHostSessionStore.getState().clear());

  const mount = () => renderHook(() => useHostIos(true), { wrapper: createWrapper(createTestQueryClient()) });

  it("boots the picked device and folds the result into the status", async () => {
    session.hostIosStatus.mockResolvedValue(shutDown);
    session.bootSimulator.mockResolvedValue({ ...ipad, state: "booting" });
    const { result } = await mount();
    await waitFor(() => expect(result.current.status).toBeDefined());

    await act(async () => result.current.devicePicker.select(ipad.udid));
    expect(result.current.canBoot).toBe(true);
    await act(async () => result.current.boot());
    expect(session.bootSimulator).toHaveBeenCalledWith({ udid: ipad.udid });
    await waitFor(() => expect(result.current.device?.state).toBe("booting"));
    expect(result.current.canBoot).toBe(false);
    expect(result.current.canKill).toBe(true);
  });

  it("shuts down gracefully and force kills only after confirming", async () => {
    session.hostIosStatus.mockResolvedValue(sampleHostIosStatus);
    session.shutdownSimulator.mockResolvedValue({ ...sampleSimDevice, state: "shutdown" });
    const { result } = await mount();
    await waitFor(() => expect(result.current.canShutdown).toBe(true));

    await act(async () => result.current.shutdown());
    expect(session.shutdownSimulator).toHaveBeenLastCalledWith(undefined);

    mockConfirm.mockResolvedValueOnce(false);
    await act(async () => result.current.kill());
    expect(mockConfirm).toHaveBeenCalledWith(SIMULATOR_KILL_CONFIRM);
    expect(session.shutdownSimulator).toHaveBeenCalledTimes(1);

    mockConfirm.mockResolvedValueOnce(true);
    await act(async () => result.current.kill());
    await waitFor(() => expect(session.shutdownSimulator).toHaveBeenLastCalledWith({ signal: "SIGKILL" }));
  });

  it("opens the screen of the picked device", async () => {
    session.hostIosStatus.mockResolvedValue(sampleHostIosStatus);
    const { result } = await mount();
    await waitFor(() => expect(result.current.canOpen).toBe(true));

    result.current.openScreen();
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: "/host/ios", params: { serial: sampleSimDevice.udid } });
  });

  it("opens the iOS stream settings", async () => {
    session.hostIosStatus.mockResolvedValue(sampleHostIosStatus);
    const { result } = await mount();

    result.current.openStreamSettings();
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: "/host/stream", params: { kind: "ios" } });
  });

  it("drops the session when the host rejects it", async () => {
    const { ApiError } = jest.requireActual<typeof import("@tesseract/client")>("@tesseract/client");
    session.hostIosStatus.mockRejectedValue(new ApiError(401, "unauthorized", "Session expired"));
    await mount();
    await waitFor(() => expect(useHostSessionStore.getState().current).toBeNull());
  });

  it("is not supported by a host without the ios routes", async () => {
    const { ApiError } = jest.requireActual<typeof import("@tesseract/client")>("@tesseract/client");
    session.hostIosStatus.mockRejectedValue(new ApiError(404, "not_found", "Not found"));
    const { result } = await mount();
    await waitFor(() => expect(result.current.supported).toBe(false));
  });
});
