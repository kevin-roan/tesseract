import { AnimatePresence, motion } from "motion/react";
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib/cx";
import { useExitInert } from "./use-exit-inert";
import { CROSSFADE_VARIANTS, type CrossfadeSpeed } from "./variants";
import styles from "./Presence.module.css";

export interface CrossfadeProps extends Omit<HTMLAttributes<HTMLDivElement>, "id" | "children" | "className"> {
  id: string | number;
  children: ReactNode;
  speed?: CrossfadeSpeed;
  inline?: boolean;
  className?: string;
  layerClassName?: string;
}

export function Crossfade({ id, children, speed = "normal", inline = false, className, layerClassName, ...rest }: CrossfadeProps) {
  return (
    <div {...rest} className={cx(styles.stack, inline && styles.inline, className)}>
      <AnimatePresence initial={false}>
        <CrossfadeLayer key={id} speed={speed} className={layerClassName}>
          {children}
        </CrossfadeLayer>
      </AnimatePresence>
    </div>
  );
}

interface CrossfadeLayerProps {
  speed: CrossfadeSpeed;
  className?: string;
  children: ReactNode;
}

function CrossfadeLayer({ speed, className, children }: CrossfadeLayerProps) {
  const ref = useExitInert();
  return (
    <motion.div
      ref={ref}
      className={cx(styles.layer, className)}
      variants={CROSSFADE_VARIANTS[speed]}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}
