import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import styles from "./Surface.module.css";

export type SurfaceTone = "neutral" | "violet" | "indigo" | "yellow";

export interface SurfaceProps {
  children?: ReactNode;
  tone?: SurfaceTone;
  direction?: "row" | "column";
  gap?: number;
  card?: boolean;
  compact?: boolean;
  className?: string;
}

export function Surface({ children, tone = "neutral", direction = "column", gap = 0, card = true, compact = false, className }: SurfaceProps) {
  return (
    <div
      className={cx(styles.surface, styles[tone], card && styles.card, compact && styles.compact, className)}
      style={{ flexDirection: direction, gap }}
    >
      {children}
    </div>
  );
}
