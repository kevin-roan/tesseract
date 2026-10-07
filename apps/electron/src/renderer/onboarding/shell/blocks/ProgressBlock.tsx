import { ProgressBar } from "../../../components/ProgressBar";
import { Text } from "../../../components/Text";
import type { Tone } from "../../../theme/colors";
import { PERCENT } from "./constants";
import styles from "./blocks.module.css";

export interface ProgressBlockProps {
  label: string;
  progress: number | null;
  detail?: string | null;
  tone?: Tone;
}

export function ProgressBlock({ label, progress, detail, tone = "info" }: ProgressBlockProps) {
  return (
    <div className={styles.progress}>
      <div className={styles.progressTop}>
        <Text variant="bodyStrong">{label}</Text>
        {progress === null ? null : (
          <Text variant="caption" color="text-secondary" tabular>
            {`${Math.round(Math.min(1, Math.max(0, progress)) * PERCENT)}%`}
          </Text>
        )}
      </div>
      <ProgressBar progress={progress} tone={tone} label={label} />
      {detail ? (
        <Text variant="caption" color="text-secondary" className={styles.progressDetail}>
          {detail}
        </Text>
      ) : null}
    </div>
  );
}
