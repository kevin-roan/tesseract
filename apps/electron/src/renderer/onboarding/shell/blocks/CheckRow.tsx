import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { ActionButton } from "../../../components/ActionButton";
import { Icon } from "../../../components/Icon";
import { PreferenceRow } from "../../../components/PreferenceRows";
import { Spinner } from "../../../components/Spinner";
import { StatusBadge } from "../../../components/StatusBadge";
import { cssVar, type Tone } from "../../../theme/colors";
import { CHECK_GLYPH_VARIANTS, CHECK_ROW_VARIANTS } from "../motion";
import { CHECK_GLYPHS, type CheckRowStatus } from "./constants";
import styles from "./blocks.module.css";

export interface CheckRowAction {
  label: string;
  onClick(): void;
  primary?: boolean;
  busy?: boolean;
  disabled?: boolean;
}

export interface CheckRowProps {
  title: string;
  subtitle?: ReactNode;
  status: CheckRowStatus;
  badge?: { label: string; tone: Tone } | null;
  action?: CheckRowAction | null;
  index?: number;
}

export function CheckRow({ title, subtitle, status, badge, action, index = 0 }: CheckRowProps) {
  const glyph = CHECK_GLYPHS[status];
  return (
    <motion.div custom={index} variants={CHECK_ROW_VARIANTS} initial="initial" animate="animate" data-check-status={status}>
      <PreferenceRow
        title={title}
        subtitle={subtitle}
        prefix={
          <span className={styles.glyph} style={{ color: cssVar(glyph.color) }}>
            <AnimatePresence initial={false}>
              <motion.span key={status} className={styles.glyphLayer} variants={CHECK_GLYPH_VARIANTS} initial="initial" animate="animate" exit="exit">
                {glyph.icon ? <Icon name={glyph.icon} /> : <Spinner size={16} />}
              </motion.span>
            </AnimatePresence>
          </span>
        }
        suffix={
          action ? (
            <ActionButton
              label={action.label}
              variant={action.primary ? "primary" : "secondary"}
              className={styles.rowButton}
              busy={action.busy}
              disabled={action.disabled || action.busy}
              onClick={action.onClick}
            />
          ) : badge ? (
            <StatusBadge label={badge.label} tone={badge.tone} />
          ) : undefined
        }
      />
    </motion.div>
  );
}
