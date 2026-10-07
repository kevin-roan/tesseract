import { Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { AppRun, HostAndroidStatus } from "@theone/protocol";
import { sampleAppRun, sampleHostAndroidStatus, sampleRunTargets } from "@theone/protocol/fixtures";

import AppRunsSection from "@/features/app-runs/components/app-runs-section";
import type { AppRunsState } from "@/features/app-runs/hooks/use-app-runs";
import { appRunEntries } from "@/features/app-runs/utils/runs";
import HostAndroid from "@/features/host-shell/components/host-android";
import type { HostAndroidState } from "@/features/host-shell/hooks/use-host-android";
import { isolationNotice, linkBlockedReason } from "@/features/host-shell/utils/android";
import { ANDROID_COPY } from "@/features/host-shell/utils/content";

jest.mock("expo-router", () => ({ useIsFocused: () => true }));

const runsState = (runs: AppRun[], overrides: Partial<AppRunsState> = {}): AppRunsState => ({
  entries: appRunEntries(sampleRunTargets, runs),
  loading: false,
  error: null,
  start: jest.fn(),
  startingTarget: null,
  stop: jest.fn(),
  stoppingId: null,
  runAction: jest.fn(),
  pendingAction: null,
  open: jest.fn(),
  deeplinkFailureFor: () => null,
  copyManifest: { copied: false, copy: jest.fn(async () => undefined), canCopy: true },
  emulator: null,
  setupEmulator: jest.fn(),
  ...overrides,
});

describe("AppRunsSection", () => {
  it("lists targets, disables unavailable ones and drives a ready run", async () => {
    const runs = runsState([sampleAppRun]);
    const onToggleLogs = jest.fn();
    await render(
      <AppRunsSection runs={runs} logsOpen={(id) => id === sampleAppRun.processIds[0]} onToggleLogs={onToggleLogs} logs={<Text>log lines</Text>} />,
    );

    expect(screen.getByText("Link the host Android emulator first")).toBeOnTheScreen();
    expect(screen.getByLabelText("Start Android emulator").props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText("Set up emulator: Android emulator"));
    expect(runs.setupEmulator).toHaveBeenCalled();
    expect(screen.queryByLabelText("Set up emulator: Linux desktop")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Start Linux desktop"));
    expect(runs.start).toHaveBeenCalledWith("flutter-linux");

    await fireEvent.press(screen.getByLabelText("Open: Web"));
    expect(runs.open).toHaveBeenCalledWith(sampleAppRun, "Web");
    await fireEvent.press(screen.getByLabelText("Reload Web"));
    expect(runs.runAction).toHaveBeenCalledWith(sampleAppRun.id, "reload");
    await fireEvent.press(screen.getByLabelText("Stop Web"));
    expect(runs.stop).toHaveBeenCalledWith(sampleAppRun.id);
    expect(screen.getByText("log lines")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Hide logs: Web"));
    expect(onToggleLogs).toHaveBeenCalledWith(sampleAppRun.processIds[0]);
  });

  it("shows a failed run's error and the deep link fallback", async () => {
    const failed: AppRun = { ...sampleAppRun, state: "failed", error: "Did not become ready within 15 minutes" };
    const failure = { runId: failed.id, manifestUrl: "http://100.64.0.2:8081" };
    const runs = runsState([failed], { deeplinkFailureFor: (runId) => (runId === failure.runId ? failure : null) });
    await render(<AppRunsSection runs={runs} logsOpen={() => false} onToggleLogs={jest.fn()} logs={null} />);

    expect(screen.getByText("Did not become ready within 15 minutes")).toBeOnTheScreen();
    expect(screen.getByText(/http:\/\/100\.64\.0\.2:8081/)).toBeOnTheScreen();
    expect(screen.getByLabelText("Start Web")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Copy URL"));
    expect(runs.copyManifest.copy).toHaveBeenCalled();
  });

  it("hands a failed run to AI and offers it only once the run has failed", async () => {
    const failed: AppRun = { ...sampleAppRun, state: "failed", error: "No Android device found" };
    const onFix = jest.fn();
    await render(<AppRunsSection runs={runsState([failed])} logsOpen={() => false} onToggleLogs={jest.fn()} logs={null} onFix={onFix} />);

    await fireEvent.press(screen.getByLabelText("Fix Web with AI"));
    expect(onFix).toHaveBeenCalledWith(failed, "Web");

    await render(<AppRunsSection runs={runsState([sampleAppRun])} logsOpen={() => false} onToggleLogs={jest.fn()} logs={null} onFix={onFix} />);
    expect(screen.queryByLabelText("Fix Web with AI")).toBeNull();
  });

  it("hides a deep link failure that belongs to an older run", async () => {
    const runs = runsState([sampleAppRun], {
      deeplinkFailureFor: (runId) => (runId === "app_old" ? { runId, manifestUrl: "http://100.64.0.2:8081" } : null),
    });
    await render(<AppRunsSection runs={runs} logsOpen={() => false} onToggleLogs={jest.fn()} logs={null} />);

    expect(screen.queryByText(/http:\/\/100\.64\.0\.2:8081/)).toBeNull();
  });
});

const androidState = (status: HostAndroidStatus, overrides: Partial<HostAndroidState> = {}): HostAndroidState => ({
  status,
  loading: false,
  error: null,
  refresh: jest.fn(),
  avd: status.avds[0] ?? null,
  avdPicker: { visible: false, options: status.avds.map((id) => ({ id, label: id })), open: jest.fn(), close: jest.fn(), select: jest.fn() },
  canStart: false,
  canStop: true,
  device: status.devices[0] ?? null,
  devicePicker: {
    visible: false,
    options: status.devices.map((item) => ({ id: item.serial, label: item.model ?? item.serial })),
    open: jest.fn(),
    close: jest.fn(),
    select: jest.fn(),
  },
  canOpen: true,
  start: jest.fn(),
  starting: false,
  stop: jest.fn(),
  stopping: false,
  openScreen: jest.fn(),
  openStreamSettings: jest.fn(),
  sandboxName: "workstation",
  canLink: true,
  linkBlocked: null,
  isolationNotice: null,
  linkedToActive: true,
  link: jest.fn(),
  linking: false,
  unlink: jest.fn(),
  unlinking: false,
  ...overrides,
});

describe("HostAndroid", () => {
  it("shows a running emulator with its link", async () => {
    const android = androidState(sampleHostAndroidStatus);
    await render(<HostAndroid android={android} />);

    expect(screen.getByText("Pixel_8_API_35")).toBeOnTheScreen();
    expect(screen.getByText("Connected")).toBeOnTheScreen();
    expect(screen.getByText("Emulator · 127.0.0.1:41555")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Open screen"));
    expect(android.openScreen).toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Stop"));
    expect(android.stop).toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Unlink"));
    expect(android.unlink).toHaveBeenCalled();
    expect(screen.queryByText("Link sandbox: workstation")).toBeNull();
  });

  it("explains that no adb device is connected", async () => {
    const status: HostAndroidStatus = { ...sampleHostAndroidStatus, devices: [] };
    await render(<HostAndroid android={androidState(status, { device: null, canOpen: false })} />);

    expect(screen.getByText(/No adb device is connected to the host/)).toBeOnTheScreen();
    expect(screen.queryByText("Open screen")).toBeNull();
  });

  it("offers start and link when stopped and unlinked", async () => {
    const status: HostAndroidStatus = {
      ...sampleHostAndroidStatus,
      emulator: { ...sampleHostAndroidStatus.emulator, state: "stopped", avd: null },
      link: { configured: false, sandboxUrl: null, connected: false, lastError: null },
    };
    const android = androidState(status, { canStart: true, canStop: false, canOpen: false, linkedToActive: false });
    await render(<HostAndroid android={android} />);

    await fireEvent.press(screen.getByText("Start"));
    expect(android.start).toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Link sandbox: workstation"));
    expect(android.link).toHaveBeenCalled();
    expect(screen.getByText("Not linked to a sandbox")).toBeOnTheScreen();
    expect(screen.queryByText("Open screen")).toBeNull();
  });

  it("disables the link and explains why while the emulator is not isolated", async () => {
    const status: HostAndroidStatus = {
      ...sampleHostAndroidStatus,
      emulator: { ...sampleHostAndroidStatus.emulator, serial: "emulator-5554", managed: false, isolated: false },
      link: { configured: false, sandboxUrl: null, connected: false, lastError: null },
    };
    const android = androidState(status, {
      linkedToActive: false,
      linkBlocked: linkBlockedReason(status),
      isolationNotice: isolationNotice(status),
    });
    await render(<HostAndroid android={android} />);

    expect(screen.getByText(ANDROID_COPY.notIsolatedTitle)).toBeOnTheScreen();
    expect(screen.getByText(ANDROID_COPY.linkBlocked)).toBeOnTheScreen();
    expect(screen.getByText("emulator-5554 · 1080×2400 · adopted · not isolated")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Link sandbox: workstation"));
    expect(android.link).not.toHaveBeenCalled();
  });

  it("warns when the host runs the emulator without isolation", async () => {
    const status: HostAndroidStatus = { ...sampleHostAndroidStatus, isolation: "none" };
    await render(<HostAndroid android={androidState(status, { isolationNotice: isolationNotice(status) })} />);

    expect(screen.getByText(ANDROID_COPY.isolationOffTitle)).toBeOnTheScreen();
    expect(screen.getByText(ANDROID_COPY.isolationOff)).toBeOnTheScreen();
  });
});
