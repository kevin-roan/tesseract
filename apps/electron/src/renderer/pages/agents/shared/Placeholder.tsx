import { motion } from "motion/react";
import { Icon } from "../../../components/Icon";
import { Spinner } from "../../../components/Spinner";
import { Text } from "../../../components/Text";
import { cx } from "../../../lib/cx";
import { fade } from "../../../theme/motion";
import type { IconName } from "../../../theme/icons";
import { PLACEHOLDER_GLYPH_SIZE, PLACEHOLDER_SPINNER_SIZE } from "./constants";
import styles from "./shared.module.css";

export interface PlaceholderProps {
  title: string;
  icon?: IconName | null;
  loading?: boolean;
  className?: string;
}

export function Placeholder({ title, icon = null, loading = false, className }: PlaceholderProps) {
  return (
    <motion.div className={cx(styles.placeholder, className)} variants={fade} initial="initial" animate="animate" aria-busy={loading || undefined}>
      {loading ? <Spinner size={PLACEHOLDER_SPINNER_SIZE} className={styles.placeholderSpinner} /> : null}
      {!loading && icon ? <Icon name={icon} size={PLACEHOLDER_GLYPH_SIZE} color="text-tertiary" className={styles.placeholderGlyph} /> : null}
      <Text variant="body" color="text-secondary" wrap lines={null} center>
        {title}
      </Text>
    </motion.div>
  );
}
