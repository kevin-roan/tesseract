import { AnimatePresence, motion } from "motion/react";
import { cx } from "../../lib/cx";
import { transition } from "../../theme/motion";
import { Icon } from "../Icon";
import { Tooltip } from "../Tooltip";
import { JUMP_BUTTON_MOTION } from "./constants";
import styles from "./JumpButton.module.css";

export interface JumpButtonProps {
  visible: boolean;
  label: string;
  onClick: () => void;
  placement?: "end" | "center";
  offset?: number;
}

export function JumpButton({ visible, label, onClick, placement = "end", offset }: JumpButtonProps) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="jump"
          className={cx(styles.anchor, styles[placement])}
          style={offset === undefined ? undefined : { bottom: offset }}
          initial="hidden"
          animate="shown"
          exit="hidden"
          variants={JUMP_BUTTON_MOTION}
          transition={transition.fast}
        >
          <Tooltip label={label} placement="top">
            <button type="button" className={styles.button} aria-label={label} onClick={onClick}>
              <Icon name="down" />
            </button>
          </Tooltip>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
