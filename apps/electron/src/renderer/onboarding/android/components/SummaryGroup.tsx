import { PreferenceRow, SettingsGroup } from "../../../components/PreferenceRows";
import { ANDROID_LABELS } from "../labels";
import { formatBytes } from "../model";
import type { DownloadSummary } from "../hooks/use-android-step";
import styles from "./groups.module.css";

export interface SummaryGroupProps {
  summary: DownloadSummary;
}

export function SummaryGroup({ summary }: SummaryGroupProps) {
  const LABELS = ANDROID_LABELS.summary;
  return (
    <SettingsGroup title={LABELS.title}>
      {summary.packages.length === 0 ? <PreferenceRow title={LABELS.nothing} /> : null}
      {summary.packages.map((row) => (
        <PreferenceRow
          key={row.path}
          title={row.title}
          suffix={<span className={styles.value}>{formatBytes(row.size)}</span>}
        />
      ))}
      {summary.packages.length > 0 ? (
        <PreferenceRow
          title={LABELS.total}
          suffix={<span className={styles.total}>{LABELS.totalValue(formatBytes(summary.download), formatBytes(summary.disk))}</span>}
        />
      ) : null}
      {!summary.enoughSpace && summary.freeBytes !== null ? (
        <PreferenceRow title={<span className={styles.error}>{LABELS.lowSpace(formatBytes(summary.freeBytes), summary.sdkRoot ?? "")}</span>} />
      ) : null}
    </SettingsGroup>
  );
}
