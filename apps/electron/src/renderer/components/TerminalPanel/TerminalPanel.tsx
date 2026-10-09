import "@xterm/xterm/css/xterm.css";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import type { TerminalHost } from "../../features/terminals/xterm-host";
import { cx } from "../../lib/cx";
import type { Tone } from "../../theme/colors";
import type { IconName } from "../../theme/icons";
import { fade } from "../../theme/motion";
import { ActionButton } from "../ActionButton";
import { Icon } from "../Icon";
import { IconButton } from "../IconButton";
import { StatusBadge } from "../StatusBadge";
import { TERMINAL_PANEL_DEFAULT_HEIGHT } from "./constants";
import { TERMINAL_PANEL_LABELS } from "./labels";
import { useTerminalMount } from "./use-terminal-mount";
import styles from "./TerminalPanel.module.css";

export interface TerminalPanelStatus {
  label: string;
  tone?: Tone;
  live?: boolean;
}

export interface TerminalPanelAction {
  label: string;
  icon?: IconName;
  disabled?: boolean;
  onClick(): void;
}

export interface TerminalPanelProps {
  title: string;
  host: TerminalHost | null;
  background: string;
  status?: TerminalPanelStatus | null;
  action?: TerminalPanelAction | null;
  placeholder?: ReactNode;
  closeLabel?: string;
  onClose?: () => void;
  height?: number;
  className?: string;
}

export function TerminalPanel({
  title,
  host,
  background,
  status,
  action,
  placeholder,
  closeLabel = TERMINAL_PANEL_LABELS.close,
  onClose,
  height = TERMINAL_PANEL_DEFAULT_HEIGHT,
  className,
}: TerminalPanelProps) {
  const ref = useTerminalMount(host);
  return (
    <section className={cx(styles.panel, className)} aria-label={title}>
      <header className={styles.header}>
        <Icon name="terminal" color="text-tertiary" />
        <span className={styles.title}>{title}</span>
        <AnimatePresence initial={false} mode="popLayout">
          {status?.label ? (
            <motion.span key={status.label} variants={fade} initial="initial" animate="animate" exit="exit">
              <StatusBadge label={status.label} tone={status.tone ?? "neutral"} live={status.live ?? false} />
            </motion.span>
          ) : null}
        </AnimatePresence>
        {action ? <ActionButton label={action.label} icon={action.icon} variant="secondary" disabled={action.disabled} onClick={action.onClick} /> : null}
        {onClose ? <IconButton icon="close" label={closeLabel} size={24} className={styles.close} onClick={onClose} /> : null}
      </header>
      {host ? (
        <div className={styles.view} style={{ height, background }}>
          <div ref={ref} className={styles.host} />
        </div>
      ) : placeholder ? (
        <div className={styles.placeholder}>{placeholder}</div>
      ) : null}
    </section>
  );
}
