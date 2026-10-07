import { AnimatedList, AnimatedListItem } from "../AnimatedList";
import { Text } from "../Text";
import { SIDEBAR_LABELS } from "./labels";
import type { SidebarRunItem } from "./model";
import { SidebarRunRow } from "./SidebarRunRow";
import styles from "./Sidebar.module.css";

export interface SidebarRunListProps {
  runs: readonly SidebarRunItem[];
  onOpenRun?: (id: string) => void;
  emptyLabel?: string;
}

export function SidebarRunList({ runs, onOpenRun, emptyLabel = SIDEBAR_LABELS.noRuns }: SidebarRunListProps) {
  if (runs.length === 0) {
    return (
      <div className={styles.runList}>
        <Text variant="caption" color="text-tertiary" className={styles.noRuns}>
          {emptyLabel}
        </Text>
      </div>
    );
  }
  return (
    <AnimatedList gap={1} className={styles.runList}>
      {runs.map((run) => (
        <AnimatedListItem key={run.id}>
          <SidebarRunRow title={run.title} tone={run.tone} running={run.running} time={run.time} onClick={onOpenRun ? () => onOpenRun(run.id) : undefined} />
        </AnimatedListItem>
      ))}
    </AnimatedList>
  );
}
