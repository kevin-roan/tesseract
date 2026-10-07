import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { reveal } from "../../theme/motion";
import styles from "./Reveal.module.css";

export interface RevealProps {
  open: boolean;
  children: ReactNode;
  id?: string;
  className?: string;
}

export function Reveal({ open, children, id, className }: RevealProps) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div key="reveal" id={id} className={cx(styles.reveal, className)} variants={reveal} initial="initial" animate="animate" exit="exit">
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
