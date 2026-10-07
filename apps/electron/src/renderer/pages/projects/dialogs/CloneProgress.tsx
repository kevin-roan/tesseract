import { useEffect } from "react";
import { LogPanel } from "../../../components/LogPanel";
import { StatusBadge } from "../../../components/StatusBadge";
import { Text } from "../../../components/Text";
import { CLONE_LOG_HEIGHT } from "../../../features/projects/constants";
import type { CloneJob } from "../../../features/projects/hooks/use-create-project";
import { useLogFollower } from "../../../features/projects/hooks/use-log-follower";
import { LOG_LABELS } from "../../../features/projects/labels";
import type { CloneOutcome } from "../../../features/projects/types";
import styles from "./dialogs.module.css";

export interface CloneProgressProps {
  job: CloneJob;
  outcome: CloneOutcome;
  onExit(code: number | null): void;
}

export function CloneProgress({ job, outcome, onExit }: CloneProgressProps) {
  const follower = useLogFollower({ onExit });
  const { follow, stop } = follower;

  useEffect(() => {
    follow("process", job.processId);
    return stop;
  }, [follow, stop, job.processId]);

  return (
    <div className={styles.progress}>
      <div className={styles.progressHeader}>
        <span className={styles.progressTitle}>
          <Text variant="bodyStrong">{job.title}</Text>
        </span>
        <StatusBadge label={outcome.label} tone={outcome.tone} />
      </div>
      <LogPanel
        className={styles.logPanel}
        title={job.logTitle}
        lines={follower.lines}
        status={follower.status}
        notice={follower.notice}
        emptyLabel={LOG_LABELS.waiting}
        jumpLabel={LOG_LABELS.jump}
        minHeight={CLONE_LOG_HEIGHT}
      />
      <Text variant="bodySmall" color="text-secondary" wrap lines={null}>
        {outcome.message}
      </Text>
    </div>
  );
}
