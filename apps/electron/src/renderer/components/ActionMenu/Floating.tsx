import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useRef, type AriaRole, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cx } from "../../lib/cx";
import { popover } from "../../theme/motion";
import { FLOATING_LAYER_ATTRIBUTE, FLOATING_OFFSET_PX } from "./constants";
import type { AnchorRect } from "./model";
import { useDismiss, useFloatingPosition, useFocusReturn } from "./use-floating";
import { useMenuKeyboard } from "./use-menu-keyboard";
import { MenuBody } from "./MenuPanel";
import styles from "./MenuPanel.module.css";

export interface FloatingProps {
  open: boolean;
  anchor: AnchorRect | null;
  onClose(): void;
  children: ReactNode;
  offset?: number;
  minWidth?: number;
  role?: AriaRole;
  id?: string;
  ariaLabel?: string;
  className?: string;
  bodyClassName?: string;
  ignoreRef?: RefObject<HTMLElement | null>;
}

export function Floating({ open, anchor, ...rest }: FloatingProps) {
  return createPortal(
    <AnimatePresence>{open && anchor ? <FloatingContent key="floating" anchor={anchor} {...rest} /> : null}</AnimatePresence>,
    document.body,
  );
}

function FloatingContent({
  anchor,
  onClose,
  children,
  offset = FLOATING_OFFSET_PX,
  minWidth,
  role = "menu",
  id,
  ariaLabel,
  className,
  bodyClassName,
  ignoreRef,
}: Omit<FloatingProps, "open" | "anchor"> & { anchor: AnchorRect }) {
  const ref = useRef<HTMLDivElement>(null);
  const isPresent = useIsPresent();
  const position = useFloatingPosition(anchor, offset, ref);
  useDismiss(ref, onClose, ignoreRef, isPresent);
  useFocusReturn(ref);
  const onKeyDown = useMenuKeyboard(onClose, isPresent);
  const style: CSSProperties = {
    pointerEvents: isPresent ? undefined : "none",
    left: position?.left ?? anchor.x,
    top: position?.top ?? anchor.y + anchor.height + offset,
    minWidth,
    transformOrigin: position?.placement === "above" ? "bottom left" : "top left",
  };
  return (
    <motion.div
      ref={ref}
      id={id}
      role={role}
      aria-label={ariaLabel}
      tabIndex={-1}
      {...(isPresent ? { [FLOATING_LAYER_ATTRIBUTE]: "" } : {})}
      className={cx(styles.panel, styles.floating, className)}
      style={style}
      variants={popover}
      initial="initial"
      animate="animate"
      exit="exit"
      onKeyDown={onKeyDown}
    >
      <MenuBody className={bodyClassName}>{children}</MenuBody>
    </motion.div>
  );
}
