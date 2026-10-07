import { cssVar, TONE_COLORS, type SemanticColor, type Tone } from "../../theme/colors";
import { cx } from "../../lib/cx";
import styles from "./ToneDot.module.css";

export type ToneDotSize = 6 | 7 | 8;

export interface ToneDotProps {
  tone?: Tone;
  color?: SemanticColor;
  size?: ToneDotSize;
  live?: boolean;
  label?: string;
  className?: string;
}

export function toneDotColor(tone: Tone, color?: SemanticColor): string {
  return cssVar(color ?? TONE_COLORS[tone].fg);
}

export function ToneDot({ tone = "neutral", color, size = 8, live = false, label, className }: ToneDotProps) {
  return (
    <span
      className={cx(styles.dot, live && styles.live, className)}
      style={{ width: size, height: size, background: toneDotColor(tone, color) }}
      data-tone={tone}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
