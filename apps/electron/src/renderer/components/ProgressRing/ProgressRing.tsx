import { cx } from "../../lib/cx";
import { cssVar, type SemanticColor } from "../../theme/colors";
import { Text } from "../Text";
import { RING } from "./constants";
import { arcDash, clampFraction, percentText, ringGeometry } from "./geometry";
import styles from "./ProgressRing.module.css";

export interface ProgressRingProps {
  progress: number | null;
  size?: number;
  thickness?: number;
  color?: SemanticColor;
  showLabel?: boolean;
  labelColor?: SemanticColor;
  label?: string;
  className?: string;
}

export function ProgressRing({
  progress,
  size = RING.size,
  thickness = RING.thickness,
  color = "accent-strong",
  showLabel = true,
  labelColor = "text-secondary",
  label,
  className,
}: ProgressRingProps) {
  const value = clampFraction(progress);
  const { center, radius } = ringGeometry(size, thickness);
  return (
    <div
      className={cx(styles.ring, className)}
      style={{ width: size, height: size, color: cssVar(color) }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
    >
      <svg className={styles.svg} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeOpacity={RING.trackAlpha} strokeWidth={thickness} />
        <circle
          className={cx(styles.arc, value <= 0 && styles.empty)}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={thickness}
          strokeLinecap="round"
          pathLength={RING.pathLength}
          strokeDasharray={arcDash(value)}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      {showLabel ? (
        <Text variant="caption" color={labelColor} center tabular className={styles.label}>
          {percentText(value)}
        </Text>
      ) : null}
    </div>
  );
}
