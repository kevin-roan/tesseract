import { motion } from "motion/react";
import { BrandMark } from "../../../components/BrandMark";
import { Text } from "../../../components/Text";
import { rise } from "../../../theme/motion";
import { BRAND_SIZE } from "./constants";
import { ABOUT_LABELS } from "./labels";
import styles from "./AboutPreferences.module.css";

export function AboutHero({ version }: { version: string }) {
  return (
    <motion.div className={styles.hero} variants={rise} initial="initial" animate="animate">
      <span className={styles.badge}>
        <BrandMark size={BRAND_SIZE / 2} />
      </span>
      <div className={styles.heroText}>
        <Text variant="h2">{ABOUT_LABELS.appName}</Text>
        <Text variant="body" color="text-secondary" selectable>
          {version}
        </Text>
        <Text variant="body" color="text-secondary" wrap lines={null}>
          {ABOUT_LABELS.tagline}
        </Text>
      </div>
    </motion.div>
  );
}
