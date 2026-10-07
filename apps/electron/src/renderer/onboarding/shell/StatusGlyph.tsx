import { AnimatePresence, motion } from "motion/react";
import type { StepStatus } from "../../../shared/contracts/onboarding";
import { Icon } from "../../components/Icon";
import { Spinner } from "../../components/Spinner";
import { cssVar } from "../../theme/colors";
import { STATUS_GLYPHS } from "./constants";
import { GLYPH_VARIANTS } from "./motion";
import styles from "./StatusGlyph.module.css";

export interface StatusGlyphProps {
  status: StepStatus;
  dimmed?: boolean;
}

export function StatusGlyph({ status, dimmed = false }: StatusGlyphProps) {
  const glyph = STATUS_GLYPHS[status];
  const color = dimmed && status === "pending" ? "text-tertiary" : glyph.color;
  return (
    <span className={styles.slot} style={{ color: cssVar(color) }} data-status={status}>
      <AnimatePresence initial={false}>
        <motion.span
          key={status}
          className={styles.layer}
          custom={status === "done"}
          variants={GLYPH_VARIANTS}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {glyph.icon ? <Icon name={glyph.icon} /> : <Spinner size={16} />}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
