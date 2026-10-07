import { cx } from "../../lib/cx";
import type { SemanticColor } from "../../theme/colors";
import { DOT_SPHERE } from "./constants";
import { useDotSphere } from "./use-dot-sphere";
import styles from "./DotSphere.module.css";

export interface DotSphereProps {
  size: number;
  dots?: number;
  color?: SemanticColor;
  spinning?: boolean;
  periodMs?: number;
  label?: string;
  className?: string;
}

export function DotSphere({ size, dots = DOT_SPHERE.dots, color = "text", spinning = false, periodMs = DOT_SPHERE.periodMs, label, className }: DotSphereProps) {
  const { canvasRef } = useDotSphere({ size, dots, color, spinning, periodMs });
  return (
    <canvas
      ref={canvasRef}
      className={cx(styles.sphere, className)}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-spinning={spinning || undefined}
    />
  );
}
