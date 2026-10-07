import { cx } from "../../lib/cx";
import type { SemanticColor } from "../../theme/colors";
import { SPARKLINE } from "./constants";
import { useSparkline } from "./use-sparkline";
import styles from "./Sparkline.module.css";

export interface SparklineProps {
  values: readonly number[];
  color?: SemanticColor | number;
  maxPoints?: number;
  min?: number | null;
  max?: number | null;
  fill?: boolean;
  height?: number;
  label?: string;
  className?: string;
}

export function Sparkline({
  values,
  color = "accent-strong",
  maxPoints = SPARKLINE.maxPoints,
  min = 0,
  max = null,
  fill = true,
  height = SPARKLINE.height,
  label,
  className,
}: SparklineProps) {
  const { containerRef, canvasRef } = useSparkline({ values, color, maxPoints, min, max, fill, height });
  return (
    <div ref={containerRef} className={cx(styles.sparkline, className)} style={{ height }}>
      <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={label} />
    </div>
  );
}
