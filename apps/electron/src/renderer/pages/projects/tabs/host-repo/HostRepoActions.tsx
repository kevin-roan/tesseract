import { ActionButton } from "../../../../components/ActionButton";
import { HostUnlockDialog } from "../../../../components/HostUnlockDialog";
import type { NoticeAction } from "../../../../features/projects/types";
import { useHostRepo } from "./hooks/use-host-repo";

export interface HostRepoActionsProps {
  projectId: string;
  projectName: string;
  report(error: unknown, action?: NoticeAction): void;
}

export function HostRepoActions({ projectId, projectName, report }: HostRepoActionsProps) {
  const repo = useHostRepo({ projectId, projectName, report });
  return (
    <>
      {repo.buttons.map((button) => (
        <ActionButton
          key={button.id}
          label={button.label}
          icon={button.icon}
          busy={button.busy}
          disabled={button.disabled}
          tooltip={button.tooltip}
          onClick={() => repo.run(button.id)}
        />
      ))}
      <HostUnlockDialog open={repo.unlockOpen} onUnlock={repo.unlock} onClose={repo.closeUnlock} onUnlocked={repo.onUnlocked} />
    </>
  );
}
