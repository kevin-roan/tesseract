import { AnimatePresence, motion } from "motion/react";
import { PropertyChip } from "../../../components/PropertyChip";
import type { PropertyChipModel } from "../../../features/projects/types";
import { fade } from "../../../theme/motion";
import styles from "./ProjectDetail.module.css";

export interface PropertyChipsProps {
  chips: readonly PropertyChipModel[];
}

export function PropertyChips({ chips }: PropertyChipsProps) {
  return (
    <div className={styles.props}>
      <AnimatePresence initial={false} mode="popLayout">
        {chips.map((chip) => (
          <motion.span key={chip.id} layout="position" variants={fade} initial="initial" animate="animate" exit="exit">
            <PropertyChip label={chip.label} icon={chip.icon} color={chip.iconColor} maxChars={chip.maxChars} tooltip={chip.tooltip} />
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
