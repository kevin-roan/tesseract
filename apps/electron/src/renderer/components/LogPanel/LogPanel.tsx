import { AnimatePresence, motion } from "motion/react";
import type { Ref } from "react";
import { cx } from "../../lib/cx";
import type { Tone } from "../../theme/colors";
import type { IconName } from "../../theme/icons";
import { fade, reveal } from "../../theme/motion";
import { ActionButton } from "../ActionButton";
import { Icon } from "../Icon";
import { IconButton } from "../IconButton";
import { LogView, type LogLine, type LogViewHandle } from "../LogView";
import { StatusBadge } from "../StatusBadge";
import { LOG_PANEL_DEFAULT_MIN_HEIGHT } from "./constants";
import { LOG_PANEL_LABELS } from "./labels";
import styles from "./LogPanel.module.css";

export interface LogPanelStatus {
  label: string;
  tone?: Tone;
  live?: boolean;
}

export interface LogPanelAction {
  label: string;
  icon?: IconName;
  onClick?: () => void;
  sensitive?: boolean;
}

export interface LogPanelProps {
  title: string;
  lines: readonly LogLine[];
  status?: LogPanelStatus | null;
  action?: LogPanelAction | null;
  notice?: string | null;
  closeLabel?: string;
  onClose?: () => void;
  emptyLabel?: string;
  jumpLabel?: string;
  minHeight?: number;
  className?: string;
  viewRef?: Ref<LogViewHandle>;
}

export function LogPanel({
  title,
  lines,
  status,
  action,
  notice,
  closeLabel = LOG_PANEL_LABELS.close,
  onClose,
  emptyLabel = LOG_PANEL_LABELS.empty,
  jumpLabel = LOG_PANEL_LABELS.jump,
  minHeight = LOG_PANEL_DEFAULT_MIN_HEIGHT,
  className,
  viewRef,
}: LogPanelProps) {
  return (
    <section className={cx(styles.panel, className)} aria-label={title}>
      <header className={styles.header}>
        <Icon name="terminal" color="text-tertiary" />
        <span className={styles.title}>{title}</span>
        {action ? (
          <ActionButton
            label={action.label}
            icon={action.icon}
            variant="secondary"
            disabled={action.sensitive === false}
            onClick={action.onClick}
          />
        ) : null}
        <AnimatePresence initial={false} mode="popLayout">
          {status?.label ? (
            <motion.span key={status.label} variants={fade} initial="initial" animate="animate" exit="exit">
              <StatusBadge label={status.label} tone={status.tone ?? "neutral"} live={status.live ?? false} />
            </motion.span>
          ) : null}
        </AnimatePresence>
        {onClose ? <IconButton icon="close" label={closeLabel} size={24} className={styles.close} onClick={onClose} /> : null}
      </header>
      <AnimatePresence initial={false}>
        {notice ? (
          <motion.div key="notice" className={styles.noticeWrap} variants={reveal} initial="initial" animate="animate" exit="exit">
            <p className={styles.notice}>{notice}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <LogView ref={viewRef} lines={lines} emptyLabel={emptyLabel} jumpLabel={jumpLabel} minHeight={minHeight} />
    </section>
  );
}
