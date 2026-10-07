import { motion } from "motion/react";
import { transition } from "../../theme/motion";
import { cx } from "../../lib/cx";
import { PROJECT_GRID } from "./constants";
import { gridColumnTemplate, type ProjectCardModel } from "./model";
import { ProjectCard } from "./ProjectCard";
import { useHasMounted } from "./use-has-mounted";
import { CARD_ENTER } from "./motion";
import styles from "./ProjectCard.module.css";

export interface ProjectGridProps {
  items: readonly ProjectCardModel[];
  onOpen(id: string): void;
  onAsk?: (id: string) => void;
  maxColumns?: number;
  className?: string;
}

export function ProjectGrid({ items, onOpen, onAsk, maxColumns = PROJECT_GRID.maxColumns, className }: ProjectGridProps) {
  const mounted = useHasMounted();
  if (items.length === 0) return null;
  return (
    <div
      className={cx(styles.grid, className)}
      style={{ gridTemplateColumns: gridColumnTemplate(PROJECT_GRID.minColumnWidth, PROJECT_GRID.gap, maxColumns) }}
    >
      {items.map((item) => (
        <motion.div
          key={item.id}
          layout="position"
          className={styles.cell}
          initial={mounted ? CARD_ENTER.initial : false}
          animate={CARD_ENTER.animate}
          transition={transition.normal}
        >
          <ProjectCard model={item} onOpen={onOpen} onAsk={onAsk} />
        </motion.div>
      ))}
    </div>
  );
}
