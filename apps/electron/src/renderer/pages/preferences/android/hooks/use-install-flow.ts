import { useCallback, useRef, useState } from "react";
import type { InstallPlan } from "../../../../../shared/contracts/android";
import { IpcError } from "../../../../../shared/ipc-types";
import { errorMessage } from "../../../../components/FormDialog";
import { ipc } from "../../../../lib/ipc";
import { usePreferencesToast } from "../../shared/use-preferences-toast";
import { ANDROID_SETTINGS_LABELS } from "../labels";

const L = ANDROID_SETTINGS_LABELS.install;

export type InstallStage = { kind: "idle" } | { kind: "licenses"; pending: string[] } | { kind: "installing" } | { kind: "failed"; message: string } | { kind: "cancelled" };

export interface InstallFlowOptions {
  onStart(): void;
  onFinished(): void;
}

export function useInstallFlow({ onStart, onFinished }: InstallFlowOptions) {
  const toast = usePreferencesToast();
  const [stage, setStage] = useState<InstallStage>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const accepted = useRef(new Set<string>());
  const plan = useRef<InstallPlan | null>(null);

  const install = useCallback(
    async (next: InstallPlan) => {
      setStage({ kind: "installing" });
      onStart();
      try {
        await ipc.android.install(next);
        setStage({ kind: "idle" });
        toast(L.done);
        onFinished();
      } catch (error) {
        if (error instanceof IpcError && error.code === "cancelled") setStage({ kind: "cancelled" });
        else setStage({ kind: "failed", message: L.failed(errorMessage(error)) });
        onFinished();
      }
    },
    [onFinished, onStart, toast],
  );

  const begin = useCallback(
    (next: InstallPlan, licenses: readonly string[]) => {
      plan.current = next;
      const pending = licenses.filter((id) => !accepted.current.has(id));
      if (pending.length > 0) setStage({ kind: "licenses", pending });
      else void install(next);
    },
    [install],
  );

  const acceptLicenses = useCallback(
    async (ids: readonly string[]) => {
      const next = plan.current;
      if (!next) return;
      setBusy(true);
      try {
        for (const id of ids) {
          await ipc.android.acceptLicense(next.sdkRoot, id);
          accepted.current.add(id);
        }
      } catch (error) {
        setStage({ kind: "failed", message: L.failed(errorMessage(error)) });
        return;
      } finally {
        setBusy(false);
      }
      void install(next);
    },
    [install],
  );

  const cancel = useCallback(() => {
    if (stage.kind === "licenses") {
      setStage({ kind: "idle" });
      return;
    }
    ipc.android.cancel().catch(() => undefined);
  }, [stage.kind]);

  return { stage, busy, begin, acceptLicenses: (ids: readonly string[]) => void acceptLicenses(ids), cancel };
}
