import { IconButton } from "../../components/IconButton";
import { StatusBadge } from "../../components/StatusBadge";
import { Text } from "../../components/Text";
import { OVERVIEW_LABELS } from "../../features/overview/labels";
import type { Tone } from "../../theme/colors";
import styles from "./Overview.module.css";

export interface OverviewHeaderProps {
  title: string;
  meta: string | null;
  badge: { label: string; tone: Tone };
  onRefresh: () => void;
}

export function OverviewHeader({ title, meta, badge, onRefresh }: OverviewHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerRow}>
        <Text as="h1" variant="h1" className={styles.title}>
          {title}
        </Text>
        <StatusBadge label={badge.label} tone={badge.tone} />
        <span className={styles.spacer} />
        <IconButton icon="refresh" label={OVERVIEW_LABELS.refresh} onClick={onRefresh} />
      </div>
      <Text variant="bodySmall" color="text-secondary">
        {meta}
      </Text>
    </header>
  );
}
