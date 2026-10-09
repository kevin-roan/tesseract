import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Icon } from "../Icon";
import { IconButton } from "../IconButton";
import { Reveal } from "../Reveal";
import { Spinner } from "../Spinner";
import { SIDEBAR } from "./constants";
import { SIDEBAR_LABELS } from "./labels";
import { SidebarCount } from "./SidebarCount";
import { SidebarItemRow } from "./SidebarItemRow";
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
  return (
    <div className={cx(styles.projectEntry, className)} data-expanded={expanded || undefined}>
      <SidebarItemRow
        name={name}
        tint={unassigned ? null : tint}
        title={unassigned ? undefined : SIDEBAR_LABELS.openProject(name)}
        label={unassigned ? name : SIDEBAR_LABELS.openProject(name)}
        onActivate={unassigned ? onToggle : onOpen}
        indicator={
          running > 0 ? (
            <Spinner size={SIDEBAR.projectIndicatorSpinner} className={styles.activitySpinner} />
          ) : (
            <Icon name={unassigned ? "agents" : "project"} />
          )
        }
        badges={
          confidential ? (
            <span className={styles.lock} title={SIDEBAR_LABELS.confidential}>
              <Icon name="confidential" color="text-tertiary" label={SIDEBAR_LABELS.confidential} />
            </span>
          ) : null
        }
        trailing={<SidebarCount count={running} title={SIDEBAR_LABELS.running(running)} className={styles.runningCount} />}
        actions={
          <>
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
          </>
        }
      />
      <Reveal open={expanded}>{children}</Reveal>
    </div>
  );
}
