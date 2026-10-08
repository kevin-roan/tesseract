import type { AppRun, RunTargetInfo } from "@tesseract/protocol";
import { useCallback, useMemo } from "react";
import { useNavigateTo } from "../../../../app/navigation";
import { ActionButton } from "../../../../components/ActionButton";
import { HostUnlockDialog } from "../../../../components/HostUnlockDialog";
import type { NoticeAction } from "../../../../features/projects/types";
import { TabConfirm } from "../kit";
import { useEmulatorLauncher } from "./hooks/use-emulator-launcher";
import { androidTarget, displayButton } from "./model";

export interface EmulatorButtonProps {
  projectId: string;
  projectName: string;
  framework: string | null;
  runTargets: readonly RunTargetInfo[] | null;
  appRuns: readonly AppRun[] | null;
  runTargetsError?: unknown;
  report(error: unknown, action?: NoticeAction): void;
  onRun?: (run: AppRun) => void;
  className?: string;
}

export function EmulatorButton({
  projectId,
  projectName,
  framework,
  runTargets,
  appRuns,
  runTargetsError = null,
  report,
  onRun,
  className,
}: EmulatorButtonProps) {
  const navigateTo = useNavigateTo();
  const launcher = useEmulatorLauncher({ projectId, projectName, report, onRun });
  const button = useMemo(() => displayButton(runTargets, appRuns, framework, runTargetsError), [runTargets, appRuns, framework, runTargetsError]);
  const { launch } = launcher;

  const activate = useCallback(() => {
    if (button.mode === "display") {
      navigateTo("display");
      return;
    }
    const target = androidTarget(runTargets);
    if (target) launch(target);
  }, [button.mode, navigateTo, runTargets, launch]);

  return (
    <>
      <ActionButton
        label={launcher.busy && launcher.busyLabel ? launcher.busyLabel : button.label}
        icon={button.icon}
        busy={launcher.busy}
        variant="secondary"
        tooltip={button.tooltip ?? undefined}
        disabled={button.disabled || launcher.busy}
        onClick={activate}
        className={className}
      />
      <TabConfirm state={launcher.confirm} />
      <HostUnlockDialog
        open={launcher.unlockOpen}
        onUnlock={launcher.unlock}
        onClose={launcher.closeUnlock}
        onUnlocked={launcher.onUnlocked}
      />
    </>
  );
}
