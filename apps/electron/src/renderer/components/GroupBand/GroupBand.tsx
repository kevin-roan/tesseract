import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import type { SemanticColor } from "../../theme/colors";
import type { IconName } from "../../theme/icons";
import { Icon } from "../Icon";
import { IconButton } from "../IconButton";
import { Text } from "../Text";
import { DEFAULT_ACTION_ICON, DEFAULT_BAND_ICON_COLOR } from "./constants";
import styles from "./GroupBand.module.css";

export interface GroupBandProps {
  title: string;
  icon?: IconName | null;
  iconColor?: SemanticColor;
  count?: number | null;
  subtitle?: string | null;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: IconName;
  trailing?: ReactNode;
  className?: string;
}

export function GroupBand({
  title,
  icon,
  iconColor = DEFAULT_BAND_ICON_COLOR,
  count,
  subtitle,
  actionLabel,
  onAction,
  actionIcon = DEFAULT_ACTION_ICON,
  trailing,
  className,
}: GroupBandProps) {
  return (
    <div className={cx(styles.band, className)}>
      {icon ? <Icon name={icon} color={iconColor} className={styles.icon} /> : null}
      <Text as="h3" variant="label" className={styles.title}>
        {title}
      </Text>
      {count === null || count === undefined ? null : (
        <Text variant="body" color="text-secondary" tabular className={styles.count}>
          {String(count)}
        </Text>
      )}
      {subtitle ? (
        <Text variant="caption" color="text-tertiary" className={styles.subtitle}>
          {subtitle}
        </Text>
      ) : (
        <span className={styles.spacer} />
      )}
      <div className={styles.trailing}>
        {trailing}
        {actionLabel && onAction ? (
          <IconButton icon={actionIcon} label={actionLabel} size={24} className={styles.action} onClick={onAction} />
        ) : null}
      </div>
    </div>
  );
}
