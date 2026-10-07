import { AnimatePresence, motion } from "motion/react";
import { cx } from "../../lib/cx";
import { transition } from "../../theme/motion";
import { Icon } from "../Icon";
import { Tooltip } from "../Tooltip";
import { COPY_ICON_SWAP } from "./constants";
import { COPY_LABELS } from "./labels";
import { useCopyFeedback } from "./use-copy-feedback";
import styles from "./CopyButton.module.css";

export interface CopyButtonProps {
  text: string;
  copyLabel?: string;
  copiedLabel?: string;
  className?: string;
}

export function CopyButton({
  text,
  copyLabel = COPY_LABELS.copy,
  copiedLabel = COPY_LABELS.copied,
  className,
}: CopyButtonProps) {
  const { copied, copy } = useCopyFeedback();
  const label = copied ? copiedLabel : copyLabel;
  return (
    <Tooltip label={label}>
      <button
        type="button"
        className={cx(styles.button, className)}
        aria-label={label}
        data-copied={copied || undefined}
        onClick={() => void copy(text)}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={copied ? "copied" : "copy"}
            className={styles.glyph}
            initial={COPY_ICON_SWAP.from}
            animate={COPY_ICON_SWAP.to}
            exit={COPY_ICON_SWAP.from}
            transition={transition.fast}
          >
            <Icon name={copied ? "success" : "copy"} />
          </motion.span>
        </AnimatePresence>
        <span className={styles.announce} aria-live="polite">
          {copied ? copiedLabel : ""}
        </span>
      </button>
    </Tooltip>
  );
}
