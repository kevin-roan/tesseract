import { cx } from "../../lib/cx";
import { SPINNER_GEOMETRY, SPINNER_TRACK_OPACITY } from "./geometry";
import styles from "./Spinner.module.css";

export interface SpinnerProps {
  size?: keyof typeof SPINNER_GEOMETRY;
  className?: string;
  label?: string;
}

export function Spinner({ size = 16, className, label }: SpinnerProps) {
  const { radius, stroke, dash, gap } = SPINNER_GEOMETRY[size];
  const center = size / 2;
  return (
    <svg
      className={cx(styles.spinner, className)}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-motion-essential=""
    >
      <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} opacity={SPINNER_TRACK_OPACITY} />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${gap}`}
      />
    </svg>
  );
}
