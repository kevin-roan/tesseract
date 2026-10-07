import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Icon } from "../Icon";
import { IconButton } from "../IconButton";
import { Reveal } from "../Reveal";
import { Spinner } from "../Spinner";
import { Text } from "../Text";
import { SIDEBAR } from "./constants";
import { SIDEBAR_LABELS } from "./labels";
import { SidebarCount } from "./SidebarCount";
import styles from "./Sidebar.module.css";

export interface SidebarProjectRowProps {
  name: string;
  tint?: number | null;
  unassigned?: boolean;
  confidential?: boolean;
  running?: number;
  expanded?: boolean;
  onOpen?: () => void;
  onNew?: () => void;
  onToggle?: () => void;
  children?: ReactNode;
  className?: string;
}

export function SidebarProjectRow({
  name,
  tint = null,
  unassigned = false,
  confidential = false,
  running = 0,
  expanded = false,
  onOpen,
  onNew,
  onToggle,
  children,
  className,
}: SidebarProjectRowProps) {
  const tinted = !unassigned && tint !== null;
  return (
    <div className={cx(styles.projectEntry, className)} data-expanded={expanded || undefined}>
      <div className={cx(styles.sideRow, tinted && styles.tinted)} style={tinted ? { ["--side-tint" as string]: `var(--to-tint-${tint})` } : undefined}>
        <button
          type="button"
          className={styles.sideMain}
          title={unassigned ? undefined : SIDEBAR_LABELS.openProject(name)}
          aria-label={unassigned ? name : SIDEBAR_LABELS.openProject(name)}
          onClick={unassigned ? onToggle : onOpen}
        >
          <span className={styles.activity}>
            {running > 0 ? (
              <Spinner size={SIDEBAR.projectIndicatorSpinner} className={styles.activitySpinner} />
            ) : (
              <Icon name={unassigned ? "agents" : "project"} />
            )}
          </span>
          <Text variant="label" color="text" className={styles.projectName}>
            {name}
          </Text>
          {confidential ? (
            <span className={styles.lock} title={SIDEBAR_LABELS.confidential}>
              <Icon name="confidential" color="text-tertiary" label={SIDEBAR_LABELS.confidential} />
            </span>
          ) : null}
          <span className={styles.spacer} />
          <SidebarCount count={running} title={SIDEBAR_LABELS.running(running)} className={styles.runningCount} />
        </button>
        {onNew ? (
          <IconButton icon="add" label={SIDEBAR_LABELS.newInProject(name)} size={22} className={styles.rowAction} onClick={onNew} />
        ) : null}
        {onToggle ? (
          <IconButton
            icon="caret-right"
            label={expanded ? SIDEBAR_LABELS.collapse : SIDEBAR_LABELS.expand}
            size={22}
            aria-expanded={expanded}
            className={cx(styles.rowAction, styles.chevron, expanded && styles.chevronOpen)}
            onClick={onToggle}
          />
        ) : null}
      </div>
      <Reveal open={expanded}>{children}</Reveal>
    </div>
  );
}
