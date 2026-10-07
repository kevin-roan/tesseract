import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Text } from "../Text";
import styles from "./Section.module.css";

export type SectionVariant = "default" | "overview";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string | null;
  actionLabel?: string;
  onAction?: () => void;
  trailing?: ReactNode;
  variant?: SectionVariant;
  className?: string;
}

export function SectionHeader({ title, subtitle, actionLabel, onAction, trailing, variant = "default", className }: SectionHeaderProps) {
  const hasAction = Boolean(actionLabel && onAction);
  return (
    <div className={cx(styles.header, className)}>
      <div className={styles.titles}>
        <Text as="h3" variant="label" className={cx(styles.title, variant === "overview" && styles.titleFlush)}>
          {title}
        </Text>
        <Text variant="caption" color="text-secondary">
          {subtitle}
        </Text>
      </div>
      {hasAction || trailing ? (
        <div className={styles.trailing}>
          {trailing}
          {hasAction ? (
            <button type="button" className={styles.linkButton} onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
