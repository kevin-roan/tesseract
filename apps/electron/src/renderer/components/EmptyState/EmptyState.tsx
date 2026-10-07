import { motion } from "motion/react";
import { cx } from "../../lib/cx";
import { rise } from "../../theme/motion";
import type { IconName } from "../../theme/icons";
import { ActionButton } from "../ActionButton";
import { Icon } from "../Icon";
import { Spinner } from "../Spinner";
import { Text } from "../Text";
import { DEFAULT_EMPTY_ICON } from "./constants";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  title: string;
  message?: string | null;
  icon?: IconName | null;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  message,
  icon = DEFAULT_EMPTY_ICON,
  loading = false,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  className,
}: EmptyStateProps) {
  const primary = actionLabel && onAction ? { label: actionLabel, onClick: onAction } : null;
  const secondary = secondaryLabel && onSecondary ? { label: secondaryLabel, onClick: onSecondary } : null;
  return (
    <motion.div className={cx(styles.root, className)} variants={rise} initial="initial" animate="animate" aria-busy={loading || undefined}>
      {loading ? (
        <Spinner size={24} />
      ) : icon ? (
        <Icon name={icon} size="2xl" color="text-tertiary" className={styles.icon} />
      ) : null}
      <Text as="h2" variant="h4" color="text-secondary" wrap lines={null} center>
        {title}
      </Text>
      <Text as="p" variant="bodySmall" color="text-tertiary" wrap lines={null} center className={styles.message}>
        {message}
      </Text>
      {primary || secondary ? (
        <div className={styles.actions}>
          {primary ? <ActionButton variant="primary" label={primary.label} onClick={primary.onClick} /> : null}
          {secondary ? <ActionButton variant="flat" label={secondary.label} onClick={secondary.onClick} /> : null}
        </div>
      ) : null}
    </motion.div>
  );
}
