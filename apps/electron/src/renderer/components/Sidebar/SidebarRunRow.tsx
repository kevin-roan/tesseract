import { cx } from "../../lib/cx";
import type { Tone } from "../../theme/colors";
import { Spinner } from "../Spinner";
import { Text } from "../Text";
import { ToneDot } from "../ToneDot";
import { SIDEBAR } from "./constants";
import styles from "./Sidebar.module.css";

export interface SidebarRunRowProps {
  title: string;
  tone?: Tone;
  running?: boolean;
  time?: string;
  onClick?: () => void;
  className?: string;
}

export function SidebarRunRow({ title, tone = "neutral", running = false, time, onClick, className }: SidebarRunRowProps) {
  return (
    <button type="button" className={cx(styles.runRow, running && styles.running, className)} title={title} onClick={onClick}>
      <span className={styles.runIndicator}>
        {running ? (
          <Spinner size={SIDEBAR.runIndicatorSpinner} className={styles.runSpinner} />
        ) : (
          <ToneDot tone={tone} size={SIDEBAR.runDotSize} />
        )}
      </span>
      <Text variant="bodySmall" color="text-secondary" className={styles.runTitle}>
        {title}
      </Text>
      {time ? (
        <Text variant="caption" color="text-tertiary" className={styles.runTime}>
          {time}
        </Text>
      ) : null}
    </button>
  );
}
