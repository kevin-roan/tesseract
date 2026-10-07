import { Icon } from "../../components/Icon";
import { PALETTE_LABELS } from "./labels";
import styles from "./CommandPalette.module.css";

export interface PaletteEmptyProps {
  query: string;
}

export function PaletteEmpty({ query }: PaletteEmptyProps) {
  return (
    <div className={styles.empty} role="status">
      <Icon name="search" color="text-tertiary" />
      <span className={styles.emptyTitle}>{PALETTE_LABELS.empty(query.trim())}</span>
      <span className={styles.emptyHint}>{PALETTE_LABELS.emptyHint}</span>
    </div>
  );
}
