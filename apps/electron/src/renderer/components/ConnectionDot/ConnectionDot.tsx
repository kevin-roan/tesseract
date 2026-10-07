import type { Tone } from "../../theme/colors";
import { cx } from "../../lib/cx";
import { Text } from "../Text";
import { ToneDot } from "../ToneDot";
import styles from "./ConnectionDot.module.css";

export interface ConnectionDotProps {
  tone?: Tone;
  label?: string | null;
  live?: boolean;
  className?: string;
}

export function ConnectionDot({ tone = "neutral", label, live = false, className }: ConnectionDotProps) {
  return (
    <span className={cx(styles.connection, className)}>
      <span className={styles.halo}>
        <ToneDot tone={tone} size={8} live={live} />
      </span>
      {label ? (
        <Text variant="caption" color="text-secondary">
          {label}
        </Text>
      ) : null}
    </span>
  );
}
