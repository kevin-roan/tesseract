import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import type { IconName } from "../../theme/icons";
import { Icon } from "../Icon";
import { Text } from "../Text";
import { Tooltip } from "../Tooltip";
import styles from "./ActionGroup.module.css";

export type ActionGroupTone = "neutral" | "warning";

export interface ActionGroupProps {
  label: string;
  icon: IconName;
  tone?: ActionGroupTone;
  muted?: boolean;
  detail?: string;
  detailTooltip?: string;
  className?: string;
  children: ReactNode;
}

export function ActionGroup({ label, icon, tone = "neutral", muted = false, detail, detailTooltip, className, children }: ActionGroupProps) {
  const accented = tone === "warning" && !muted;
  return (
    <div role="group" aria-label={label} data-tone={tone} data-muted={muted || undefined} className={cx(styles.group, className)}>
      <div className={styles.header}>
        <Icon name={icon} size={12} className={styles.icon} />
        <Text variant="overline" color={accented ? "warning" : "text-secondary"} className={styles.label}>
          {label}
        </Text>
        {detail ? (
          <Tooltip label={detailTooltip}>
            <Text variant="caption" color="text-tertiary" className={styles.detail}>
              {detail}
            </Text>
          </Tooltip>
        ) : null}
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
