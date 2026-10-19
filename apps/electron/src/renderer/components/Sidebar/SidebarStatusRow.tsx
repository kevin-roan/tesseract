import { forwardRef, type MouseEvent, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Icon } from "../Icon";
import { Text } from "../Text";
import styles from "./Sidebar.module.css";

export interface SidebarStatusRowProps {
  indicator?: ReactNode;
  title: string;
  detail?: string;
  tooltip?: string;
  open?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

export const SidebarStatusRow = forwardRef<HTMLButtonElement, SidebarStatusRowProps>(function SidebarStatusRow(
  { indicator, title, detail, tooltip, open, onClick, className },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx(styles.statusRow, className)}
      title={tooltip}
      aria-haspopup={open === undefined ? undefined : "menu"}
      aria-expanded={open}
      onClick={onClick}
    >
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
});
