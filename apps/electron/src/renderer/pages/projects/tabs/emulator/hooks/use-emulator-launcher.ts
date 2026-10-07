import { useQueryClient } from "@tanstack/react-query";
import type { AppRun, RunTargetInfo } from "@theone/protocol";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HostShellState } from "../../../../../../shared/contracts/hostShell";
import { describeError, NotConfiguredError } from "../../../../../app/connection";
import { useApiClient, useConnectionSnapshot } from "../../../../../app/data";
import { usePreferencesRoute } from "../../../../../app/navigation";
import { showToast } from "../../../../../components/Toast";
import { IpcError } from "../../../../../../shared/ipc-types";
import { ipc } from "../../../../../lib/ipc";
import type { NoticeAction } from "../../../../../features/projects/types";
import { useConfirm, type ConfirmState } from "../../kit";
import { ANDROID_ONBOARDING_STEP, HOST_SHELL_SECTION, NO_SERIAL_CODE, SCRCPY_MISSING_CODE } from "../constants";
import { EMULATOR_LABELS } from "../labels";
import { hostAndroid, HostRequestError, prepareEmulator, runOnEmulator, type EmulatorRun } from "../launcher";
import { confirmSteps, hostBlocker, hostFixable, hostUnlocked, planEmulator, type ConfirmStep, type EmulatorPlan, type EmulatorStage } from "../model";
import { HOST_SHELL_STATE_KEY } from "../../../../../features/host-shell/constants";

export interface EmulatorLauncherOptions {
  projectId: string;
  projectName: string;
  report(error: unknown, action?: NoticeAction): void;
  onRun?: (run: AppRun) => void;
}

export interface EmulatorLauncher {
  busy: boolean;
  busyLabel: string | null;
  launch(target: RunTargetInfo): void;
  confirm: ConfirmState;
  unlockOpen: boolean;
  closeUnlock(): void;
  unlock(pin: string): Promise<void>;
  onUnlocked(): void;
}

const host = hostAndroid({
  status: () => ipc.hostShell.androidStatus(),
  startEmulator: (avd) => ipc.hostShell.startEmulator(avd),
  stopEmulator: () => ipc.hostShell.stopEmulator(),
  linkSandbox: (url, token) => ipc.hostShell.linkSandbox(url, token),
});

export function useEmulatorLauncher({ projectId, projectName, report, onRun }: EmulatorLauncherOptions): EmulatorLauncher {
  const client = useApiClient();
  const token = useConnectionSnapshot().data?.config?.token ?? null;
  const queryClient = useQueryClient();
  const { openPreferences } = usePreferencesRoute();
  const confirm = useConfirm();
  const [busy, setBusyState] = useState<{ on: boolean; label: string | null }>({ on: false, label: null });
  const [unlockOpen, setUnlockOpen] = useState(false);
  const retry = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  const latest = useRef({ report, onRun, projectName, client, token });
  latest.current = { report, onRun, projectName, client, token };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const setBusy = useCallback((on: boolean, label: string | null = null) => {
    if (mounted.current) setBusyState({ on, label });
  }, []);

  const say = useCallback((message: string, action?: NoticeAction) => latest.current.report(new Error(message), action), []);

  const openViewer = useCallback(
    (serial: string) => {
      ipc.hostShell.openEmulatorViewer({ serial, title: EMULATOR_LABELS.title(latest.current.projectName) }).catch((error: unknown) => {
        if (error instanceof IpcError && error.code === SCRCPY_MISSING_CODE) showToast(EMULATOR_LABELS.noScrcpy);
        else if (error instanceof IpcError && error.code === NO_SERIAL_CODE) say(EMULATOR_LABELS.noSerial);
        else say(EMULATOR_LABELS.viewerFailed(error instanceof Error ? error.message : String(error)));
      });
    },
    [say],
  );

  const handleRun = useCallback(
    ({ run, started, serial }: EmulatorRun) => {
      latest.current.onRun?.(run);
      if (started) showToast(EMULATOR_LABELS.started);
      if (serial) openViewer(serial);
      else say(EMULATOR_LABELS.noSerial);
    },
    [openViewer, say],
  );

  const failed = useCallback(
    (error: unknown) => {
      if (error instanceof HostRequestError) {
        if (error.auth) void ipc.hostShell.lock().catch(() => undefined);
        say(EMULATOR_LABELS.hostFailed(error.message));
        return;
      }
      say(EMULATOR_LABELS.failed(describeError(error)));
    },
    [say],
  );

  const run = useCallback(
    async (work: () => Promise<EmulatorRun>) => {
      setBusy(true);
      try {
        handleRun(await work());
      } catch (error) {
        failed(error);
      } finally {
        setBusy(false);
      }
    },
    [setBusy, handleRun, failed],
  );

  const prepare = useCallback(
    (target: RunTargetInfo, plan: EmulatorPlan) => {
      const { client, token } = latest.current;
      if (client === null || token === null) {
        failed(new NotConfiguredError());
        return;
      }
      const onStage = (stage: EmulatorStage) => {
        const label = EMULATOR_LABELS.progress[stage];
        setBusy(true, label);
        if (stage !== "booting") showToast(label);
      };
      void run(async () => {
        await prepareEmulator({ host, client, sandbox: { url: client.baseUrl, token }, projectId, target: target.target, plan, onStage });
        return runOnEmulator(client, projectId, target.target);
      });
    },
    [projectId, run, setBusy, failed],
  );

  const confirmThen = useCallback(
    (steps: ConfirmStep[], proceed: () => void) => {
      const [step, ...rest] = steps;
      if (!step) {
        proceed();
        return;
      }
      const next = () => confirmThen(rest, proceed);
      if (step.kind === "restart") {
        confirm.ask({
          heading: EMULATOR_LABELS.restartTitle,
          body: EMULATOR_LABELS.restartBody(step.avd),
          confirmLabel: EMULATOR_LABELS.restartConfirm,
          cancelLabel: EMULATOR_LABELS.cancel,
          onConfirm: next,
        });
        return;
      }
      confirm.ask({
        heading: EMULATOR_LABELS.relinkTitle,
        body: EMULATOR_LABELS.relinkBody(step.url),
        confirmLabel: EMULATOR_LABELS.relinkConfirm,
        cancelLabel: EMULATOR_LABELS.cancel,
        destructive: false,
        onConfirm: next,
      });
    },
    [confirm],
  );

  const withHost = useCallback(
    async (target: RunTargetInfo): Promise<void> => {
      const state = await ipc.hostShell.state().catch((): HostShellState | null => null);
      if (state) queryClient.setQueryData(HOST_SHELL_STATE_KEY, state);
      const blocker = hostBlocker(state);
      if (blocker !== null) {
        void ipc.hostShell.refresh().catch(() => undefined);
        say(blocker, { label: EMULATOR_LABELS.preferences, run: () => openPreferences(HOST_SHELL_SECTION) });
        return;
      }
      if (!hostUnlocked(state)) {
        retry.current = () => void withHost(target);
        if (mounted.current) setUnlockOpen(true);
        return;
      }
      setBusy(true, EMULATOR_LABELS.progress.checking);
      let status;
      try {
        status = await host.status();
      } catch (error) {
        setBusy(false);
        if (error instanceof HostRequestError && error.auth) {
          await ipc.hostShell.lock().catch(() => undefined);
          return withHost(target);
        }
        say(EMULATOR_LABELS.hostFailed(error instanceof Error ? error.message : String(error)));
        return;
      }
      setBusy(false);
      const client = latest.current.client;
      if (client === null) {
        failed(new NotConfiguredError());
        return;
      }
      const plan = planEmulator(status, client.baseUrl);
      if (plan.blocked !== null) {
        const setup =
          plan.blocked === EMULATOR_LABELS.noAvd
            ? { label: EMULATOR_LABELS.setupEmulator, run: () => void ipc.window.openOnboarding(ANDROID_ONBOARDING_STEP) }
            : undefined;
        say(EMULATOR_LABELS.unavailable(plan.blocked), setup);
        return;
      }
      confirmThen(confirmSteps(plan), () => prepare(target, plan));
    },
    [queryClient, say, openPreferences, setBusy, failed, confirmThen, prepare],
  );

  const launch = useCallback(
    (target: RunTargetInfo) => {
      if (target.available) {
        const client = latest.current.client;
        if (client === null) {
          failed(new NotConfiguredError());
          return;
        }
        void run(() => runOnEmulator(client, projectId, target.target));
      } else if (!hostFixable(target)) {
        say(EMULATOR_LABELS.unavailable(target.reason ?? ""));
      } else {
        void withHost(target);
      }
    },
    [run, projectId, say, withHost, failed],
  );

  const onUnlocked = useCallback(() => {
    const next = retry.current;
    retry.current = null;
    next?.();
  }, []);

  return useMemo(
    () => ({
      busy: busy.on,
      busyLabel: busy.label,
      launch,
      confirm,
      unlockOpen,
      closeUnlock: () => setUnlockOpen(false),
      unlock: async (pin: string) => {
        const state = await ipc.hostShell.unlock(pin);
        queryClient.setQueryData(HOST_SHELL_STATE_KEY, state);
      },
      onUnlocked,
    }),
    [busy, launch, confirm, unlockOpen, queryClient, onUnlocked],
  );
}
