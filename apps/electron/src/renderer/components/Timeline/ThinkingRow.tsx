import { Spinner } from "../Spinner";
import { Text } from "../Text";
import { ActivityRow } from "./ActivityRow";
import { ACTIVITY_SPINNER_SIZE } from "./constants";
import { TIMELINE_LABELS } from "./labels";
import styles from "./Timeline.module.css";

export interface ThinkingRowProps {
  label?: string;
}

export function ThinkingRow({ label = TIMELINE_LABELS.thinking }: ThinkingRowProps) {
  return (
    <ActivityRow inset glyph={<Spinner size={ACTIVITY_SPINNER_SIZE} />} className={styles.thinking}>
      <Text variant="caption" color="text-secondary">
        {label}
      </Text>
    </ActivityRow>
  );
}
