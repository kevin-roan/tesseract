import { cssVar, TONE_COLORS, type Tone } from "../../theme/colors";
import type { IconName } from "../../theme/icons";
import { cx } from "../../lib/cx";
import { Icon } from "../Icon";
import { ToneDot } from "../ToneDot";
import styles from "./StatusBadge.module.css";

export interface StatusBadgeProps {
  label: string;
  tone?: Tone;
  icon?: IconName;
  live?: boolean;
  className?: string;
}

export function StatusBadge({ label, tone = "neutral", icon, live = false, className }: StatusBadgeProps) {
  return (
    <span className={cx(styles.badge, className)}>
      {icon ? (
        <span className={styles.icon} style={{ color: cssVar(TONE_COLORS[tone].fg) }}>
          <Icon name={icon} />
        </span>
      ) : (
        <ToneDot tone={tone} size={6} live={live} />
      )}
      <span className={styles.label}>{label}</span>
    </span>
  );
}
