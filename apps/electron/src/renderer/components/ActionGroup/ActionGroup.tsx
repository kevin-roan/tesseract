import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Text } from "../Text";
import { Tooltip } from "../Tooltip";
import styles from "./ActionGroup.module.css";

export type ActionGroupTone = "neutral" | "warning";

export interface ActionGroupProps {
  label: string;
  tone?: ActionGroupTone;
  muted?: boolean;
  detail?: string;
  detailTooltip?: string;
  className?: string;
  children: ReactNode;
}

/** A Linear-style property row: a fixed label column followed by inline content. */
export function ActionGroup({ label, tone = "neutral", muted = false, detail, detailTooltip, className, children }: ActionGroupProps) {
  const accented = tone === "warning" && !muted;
  return (
    <div role="group" aria-label={label} data-tone={tone} data-muted={muted || undefined} className={cx(styles.group, className)}>
      <Text variant="body" color={accented ? "warning" : "text-tertiary"} className={styles.label}>
        {label}
      </Text>
      <div className={styles.body}>
        {children}
        {detail ? (
          <Tooltip label={detailTooltip}>
            <Text variant="code" color="text-tertiary" className={styles.detail}>
              {detail}
            </Text>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
