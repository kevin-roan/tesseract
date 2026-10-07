import type { Project } from "@theone/protocol";
import { AnimatedList, AnimatedListItem } from "../../components/AnimatedList";
import { Text } from "../../components/Text";
import { LAUNCHERS } from "../../features/terminals/constants";
import { SIDEBAR_LABELS } from "../../features/terminals/labels";
import type { LaunchRequest, SessionRowModel } from "../../features/terminals/types";
import { LaunchChip } from "./LaunchChip";
import { SessionRow } from "./SessionRow";
import styles from "./SessionsSidebar.module.css";

export interface SessionsSidebarProps {
  rows: readonly SessionRowModel[] | null;
  count: number;
  selectedId: string | null;
  creating: boolean;
  projects: readonly Project[] | null;
  onSelect(id: string): void;
  onDelete(id: string): void;
  onLaunch(request: LaunchRequest): void;
}

export function SessionsSidebar({ rows, count, selectedId, creating, projects, onSelect, onDelete, onLaunch }: SessionsSidebarProps) {
  return (
    <div className={styles.sidebar}>
      <div className={styles.heading}>
        <Text variant="label">{SIDEBAR_LABELS.title}</Text>
        {count > 0 ? (
          <Text variant="label" color="text-tertiary" tabular>
            {String(count)}
          </Text>
        ) : null}
      </div>
      <div className={styles.launchers}>
        {LAUNCHERS.map((launcher) => (
          <LaunchChip
            key={launcher.kind}
            icon={launcher.icon}
            label={launcher.label}
            tooltip={launcher.tooltip}
            disabled={creating}
            projects={projects}
            onLaunch={(projectId) => onLaunch({ kind: launcher.kind, projectId })}
          />
        ))}
      </div>
      {rows && rows.length > 0 ? (
        <div className={styles.list} role="listbox" aria-label={SIDEBAR_LABELS.title}>
          <AnimatedList>
            {rows.map((row) => (
              <AnimatedListItem key={row.id}>
                <SessionRow row={row} selected={row.id === selectedId} onSelect={onSelect} onDelete={onDelete} />
              </AnimatedListItem>
            ))}
          </AnimatedList>
        </div>
      ) : (
        <div className={styles.empty}>
          <Text variant="body" color="text-secondary" center>
            {SIDEBAR_LABELS.empty}
          </Text>
        </div>
      )}
    </div>
  );
}
