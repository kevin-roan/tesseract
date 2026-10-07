import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Icon } from "../Icon";
import { Text } from "../Text";
import styles from "./Sidebar.module.css";

export interface SidebarStatusRowProps {
  indicator?: ReactNode;
  title: string;
  detail?: string;
  tooltip?: string;
  onClick?: () => void;
  className?: string;
}

export function SidebarStatusRow({ indicator, title, detail, tooltip, onClick, className }: SidebarStatusRowProps) {
  return (
    <button type="button" className={cx(styles.statusRow, className)} title={tooltip} onClick={onClick}>
      {indicator ? <span className={styles.statusIndicator}>{indicator}</span> : null}
      <Text variant="label" color="text-secondary" className={styles.statusTitle}>
        {title}
      </Text>
      <Text variant="caption" color="text-tertiary" className={styles.statusDetail}>
        {detail}
      </Text>
      <span className={styles.spacer} />
      <Icon name="settings" color="text-tertiary" />
    </button>
  );
}
