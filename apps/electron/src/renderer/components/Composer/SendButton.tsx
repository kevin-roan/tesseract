import { AnimatePresence, motion } from "motion/react";
import type { ButtonHTMLAttributes } from "react";
import { cx } from "../../lib/cx";
import { fade } from "../../theme/motion";
import { Icon } from "../Icon";
import { Spinner } from "../Spinner";
import { Tooltip } from "../Tooltip";
import { SEND_ICON_SIZE, SEND_SPINNER_SIZE } from "./constants";
import styles from "./SendButton.module.css";

export type SendButtonShape = "round" | "pill" | "compact";

export interface SendButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  shape?: SendButtonShape;
  busy?: boolean;
  stopLabel?: string;
  tooltip?: string;
}

export function SendButton({ label, shape = "round", busy = false, stopLabel, tooltip, className, type = "button", ...rest }: SendButtonProps) {
  const stopping = busy && stopLabel !== undefined;
  const content = stopping ? "stop" : busy ? "busy" : "idle";
  const accessible = stopping ? stopLabel : label;
  return (
    <Tooltip label={tooltip ?? accessible} placement="top">
      <button
        {...rest}
        type={type}
        aria-label={accessible}
        aria-busy={busy || undefined}
        data-state={content}
        className={cx(styles.send, styles[shape], stopping && styles.stop, className)}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={content} className={styles.content} variants={fade} initial="initial" animate="animate" exit="exit">
            {content === "busy" ? (
              <Spinner size={SEND_SPINNER_SIZE} />
            ) : content === "stop" ? (
              <Icon name="stop" size={SEND_SPINNER_SIZE} className={styles.stopIcon} />
            ) : shape === "pill" ? (
              label
            ) : (
              <Icon name="send" size={SEND_ICON_SIZE} />
            )}
          </motion.span>
        </AnimatePresence>
      </button>
    </Tooltip>
  );
}
