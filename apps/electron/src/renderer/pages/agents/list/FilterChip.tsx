import { motion } from "motion/react";
import { Icon } from "../../../components/Icon";
import { Tooltip } from "../../../components/Tooltip";
import { cx } from "../../../lib/cx";
import { popover } from "../../../theme/motion";
import typography from "../../../theme/typography.module.css";
import { CHIP_ICON_SIZE } from "../shared/constants";
import styles from "./ConversationList.module.css";

export interface FilterChipProps {
  label: string;
  tooltip: string;
  onClear(): void;
}

export function FilterChip({ label, tooltip, onClear }: FilterChipProps) {
  return (
    <motion.div className={styles.chipRow} variants={popover} initial="initial" animate="animate" exit="exit">
      <Tooltip label={tooltip}>
        <button type="button" className={styles.filterChip} onClick={onClear} aria-label={tooltip}>
          <Icon name="filter" size={CHIP_ICON_SIZE} color="text-secondary" />
          <span className={cx(typography.caption, styles.chipLabel)}>{label}</span>
          <Icon name="close" size={CHIP_ICON_SIZE} color="text-tertiary" />
        </button>
      </Tooltip>
    </motion.div>
  );
}
