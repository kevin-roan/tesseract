import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "../../lib/cx";
import { popover } from "../../theme/motion";
import { Kbd } from "../Kbd";
import { TRANSFORM_ORIGIN, type TooltipPlacement } from "./position";
import { useTooltip } from "./use-tooltip";
import styles from "./Tooltip.module.css";

export interface TooltipProps {
  label: ReactNode;
  shortcut?: string;
  placement?: TooltipPlacement;
  open?: boolean;
  delayMs?: number;
  shouldShow?: (anchor: Element) => boolean;
  children: ReactNode;
}

export function Tooltip({ label, shortcut, placement = "bottom", open, delayMs, shouldShow, children }: TooltipProps) {
  const enabled = label !== null && label !== undefined && label !== "" && label !== false;
  const tooltip = useTooltip({ enabled, placement, forcedOpen: open, delayMs, shouldShow });
  const resolved = tooltip.position?.placement ?? placement;
  return (
    <>
      <span className={styles.anchor} {...tooltip.anchorProps}>
        {children}
      </span>
      {typeof document === "undefined"
        ? null
        : createPortal(
            <AnimatePresence>
              {tooltip.open ? (
                <motion.div
                  key="tooltip"
                  ref={tooltip.floatingRef}
                  id={tooltip.id}
                  role="tooltip"
                  className={cx(styles.tooltip, !tooltip.position && styles.pending)}
                  style={{
                    left: tooltip.position?.left ?? 0,
                    top: tooltip.position?.top ?? 0,
                    transformOrigin: TRANSFORM_ORIGIN[resolved],
                  }}
                  variants={popover}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <span>{label}</span>
                  {shortcut ? <Kbd keys={shortcut} size="sm" /> : null}
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )}
    </>
  );
}
