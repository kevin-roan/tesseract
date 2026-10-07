import { AnimatePresence, motion } from "motion/react";
import { Icon } from "../../../components/Icon";
import { PreferenceRow } from "../../../components/PreferenceRows";
import { Spinner } from "../../../components/Spinner";
import { Text } from "../../../components/Text";
import { cssVar } from "../../../theme/colors";
import { fade, rise, stagger, STAGGER_MS } from "../../../theme/motion";
import type { BuildRowStatus } from "../model";
import { BUILD_ROW_GLYPHS } from "../options";
import styles from "./parts.module.css";

export interface PhaseRowProps {
  title: string;
  status: BuildRowStatus;
  caption: string | null;
  index: number;
}

export function PhaseRow({ title, status, caption, index }: PhaseRowProps) {
  const glyph = BUILD_ROW_GLYPHS[status];
  return (
    <motion.div
      variants={rise}
      initial="initial"
      animate="animate"
      transition={stagger(index, STAGGER_MS.checks)}
      data-phase-status={status}
    >
      <PreferenceRow
        className={styles.phaseRow}
        title={title}
        prefix={
          <span className={styles.glyph} style={{ color: cssVar(glyph.color) }}>
            <AnimatePresence initial={false}>
              <motion.span
                key={status}
                className={styles.glyphLayer}
                variants={fade}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {glyph.icon ? <Icon name={glyph.icon} /> : <Spinner size={16} />}
              </motion.span>
            </AnimatePresence>
          </span>
        }
        suffix={
          caption ? (
            <Text variant="caption" color="text-tertiary" tabular>
              {caption}
            </Text>
          ) : undefined
        }
      />
    </motion.div>
  );
}
