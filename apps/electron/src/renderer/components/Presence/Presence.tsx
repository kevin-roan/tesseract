import { AnimatePresence, motion, type Variants } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { fade } from "../../theme/motion";

export interface PresenceProps {
  show: boolean;
  children: ReactNode;
  variants?: Variants;
  as?: "div" | "span";
  initial?: boolean;
  className?: string;
  style?: CSSProperties;
  onExitComplete?: () => void;
}

export function Presence({ show, children, variants = fade, as = "div", initial = false, className, style, onExitComplete }: PresenceProps) {
  const Element = as === "span" ? motion.span : motion.div;
  return (
    <AnimatePresence initial={initial} onExitComplete={onExitComplete}>
      {show ? (
        <Element key="presence" className={className} style={style} variants={variants} initial="initial" animate="animate" exit="exit">
          {children}
        </Element>
      ) : null}
    </AnimatePresence>
  );
}
