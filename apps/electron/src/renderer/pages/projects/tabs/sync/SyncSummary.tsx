import { Text } from "../../../../components/Text";
import type { SummaryRow } from "./model";
import styles from "./SyncTab.module.css";

export interface SyncSummaryProps {
  rows: SummaryRow[];
}

export function SyncSummary({ rows }: SyncSummaryProps) {
  return (
    <dl className={styles.summary}>
      {rows.map((row) => (
        <div key={row.key} className={styles.summaryRow}>
          <dt>
            <Text variant="bodySmall" color="text-secondary">
              {row.key}
            </Text>
          </dt>
          <dd className={styles.summaryValue}>
            <Text variant="bodySmall" wrap lines={2} selectable>
              {row.value}
            </Text>
          </dd>
        </div>
      ))}
    </dl>
  );
}
