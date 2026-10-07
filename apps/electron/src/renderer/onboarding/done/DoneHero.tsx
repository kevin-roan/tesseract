import { motion } from "motion/react";
import { Text } from "../../components/Text";
import { ICON_STROKE_WIDTH } from "../../theme/icons";
import { HERO_CHECK } from "./constants";
import { drawStroke } from "./motion";
import styles from "./DoneStep.module.css";

export interface DoneHeroProps {
  title: string;
  description: string;
}

export function DoneHero({ title, description }: DoneHeroProps) {
  return (
    <div className={styles.hero}>
      <span className={styles.badge} data-testid="done-badge">
        <svg
          width={HERO_CHECK.size}
          height={HERO_CHECK.size}
          viewBox={HERO_CHECK.viewBox}
          fill="none"
          stroke="currentColor"
          strokeWidth={ICON_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <motion.circle {...HERO_CHECK.circle} {...drawStroke(0)} />
          <motion.path d={HERO_CHECK.tick} {...drawStroke(HERO_CHECK.tickDelayMs)} />
        </svg>
      </span>
      <div className={styles.copy}>
        <Text variant="h2">{title}</Text>
        <Text variant="body" color="text-secondary" wrap lines={null}>
          {description}
        </Text>
      </div>
    </div>
  );
}
