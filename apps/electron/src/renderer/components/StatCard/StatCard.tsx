import { AnimatePresence, motion } from "motion/react";
import { cx } from "../../lib/cx";
import { Icon } from "../Icon";
import { ProgressBar } from "../ProgressBar";
import { Text } from "../Text";
import { Tooltip } from "../Tooltip";
import { STAT_BAR_COLOR, STAT_ICON_SIZE, VALUE_SWAP_VARIANTS } from "./constants";
import { statPercent } from "./model";
import type { StatItem } from "./types";
import styles from "./StatCard.module.css";

export type StatCardProps = Omit<StatItem, "id"> & { className?: string };

export function StatCard({ icon, label, value, unit, progress = null, tone = "neutral", caption, onActivate, className }: StatCardProps) {
  const hasProgress = progress !== null && progress !== undefined;
  const content = (
    <>
      <div className={styles.top}>
        <Icon name={icon} size={STAT_ICON_SIZE} color="text-tertiary" />
        <Text variant="bodySmall" color="text-secondary" className={styles.label}>
          {label}
        </Text>
        {hasProgress ? (
          <Text variant="caption" color="text-tertiary" tabular className={styles.percent}>
            {statPercent(progress)}
          </Text>
        ) : null}
      </div>
      <div className={styles.values}>
        <div className={styles.valueRow}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span key={value} className={styles.value} variants={VALUE_SWAP_VARIANTS} initial="initial" animate="animate" exit="exit">
              <Text variant="metricSmall">{value}</Text>
            </motion.span>
          </AnimatePresence>
          <Text variant="bodySmall" color="text-secondary" className={styles.unit}>
            {unit}
          </Text>
        </div>
        <Text variant="caption" color="text-tertiary" className={styles.caption}>
          {caption}
        </Text>
      </div>
      {hasProgress ? <ProgressBar progress={progress} color={STAT_BAR_COLOR[tone]} label={label} className={styles.bar} /> : null}
    </>
  );
  if (onActivate) {
    return (
      <Tooltip label={label}>
        <button type="button" className={cx(styles.tile, styles.pressable, className)} data-tone={tone} onClick={onActivate}>
          {content}
        </button>
      </Tooltip>
    );
  }
  return (
    <div className={cx(styles.tile, className)} data-tone={tone}>
      {content}
    </div>
  );
}
