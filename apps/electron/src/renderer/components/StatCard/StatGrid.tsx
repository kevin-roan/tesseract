import { motion } from "motion/react";
import { cx } from "../../lib/cx";
import { rise, stagger, STAGGER_MS } from "../../theme/motion";
import { STAT_GRID } from "./constants";
import { StatCard } from "./StatCard";
import type { StatItem } from "./types";
import { useStatColumns } from "./use-stat-columns";
import styles from "./StatCard.module.css";

export interface StatGridProps {
  items: readonly StatItem[];
  minColumns?: number;
  maxColumns?: number;
  className?: string;
}

export function StatGrid({ items, minColumns = STAT_GRID.minColumns, maxColumns = STAT_GRID.maxColumns, className }: StatGridProps) {
  const { ref, columns } = useStatColumns(minColumns, maxColumns);
  return (
    <div ref={ref} className={cx(styles.grid, className)} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {items.map(({ id, ...item }, index) => (
        <motion.div key={id} className={styles.cell} variants={rise} initial="initial" animate="animate" transition={stagger(index, STAGGER_MS.rows)}>
          <StatCard {...item} />
        </motion.div>
      ))}
    </div>
  );
}
