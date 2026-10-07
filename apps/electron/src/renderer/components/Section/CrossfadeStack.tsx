import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Crossfade } from "../Presence/Crossfade";
import styles from "./Section.module.css";

export interface CrossfadeStackProps {
  view: string;
  children: ReactNode;
  className?: string;
}

export function CrossfadeStack({ view, children, className }: CrossfadeStackProps) {
  return (
    <Crossfade id={view} data-view={view} className={cx(styles.stack, className)} layerClassName={styles.layer}>
      {children}
    </Crossfade>
  );
}
