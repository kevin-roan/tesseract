import { cssVar, TONE_COLORS, type Tone } from "../../theme/colors";
import type { IconName } from "../../theme/icons";
import { cx } from "../../lib/cx";
import { Icon } from "../Icon";
import { Text } from "../Text";
import { TONE_ICONS } from "./tone-icons";
import styles from "./Notice.module.css";

export interface NoticeProps {
  message: string;
  title?: string;
  tone?: Tone;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
  floating?: boolean;
  className?: string;
}

export function Notice({ message, title, tone = "neutral", icon, actionLabel, onAction, floating = false, className }: NoticeProps) {
  const color = cssVar(TONE_COLORS[tone].fg);
  return (
    <div className={cx(styles.notice, floating && styles.floating, className)} role={tone === "danger" ? "alert" : "status"}>
      <span className={styles.icon} style={{ color }}>
        <Icon name={icon ?? TONE_ICONS[tone]} />
      </span>
      <div className={styles.body}>
        {title ? (
          <span className={styles.title} style={{ color }}>
            {title}
          </span>
        ) : null}
        <Text variant="bodySmall" color="text-secondary" wrap lines={null}>
          {message}
        </Text>
      </div>
      {actionLabel && onAction ? (
        <button type="button" className={styles.action} style={{ color }} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
