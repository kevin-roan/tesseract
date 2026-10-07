import type { CSSProperties } from "react";
import { cx } from "../../lib/cx";
import styles from "./Skeleton.module.css";

export type SkeletonShape = "text" | "circle" | "block";

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  shape?: SkeletonShape;
  className?: string;
}

export function Skeleton({ width = "100%", height, shape = "text", className }: SkeletonProps) {
  const style: CSSProperties = { width, ...(height === undefined ? {} : { height }) };
  if (shape === "circle") style.height = height ?? width;
  return <span aria-hidden className={cx(styles.bone, styles[shape], className)} style={style} />;
}
