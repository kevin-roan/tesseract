import { cx } from "../../lib/cx";
import { LEGEND_LABELS } from "./labels";
import { Tooltip } from "../Tooltip";
import { NO_HIDDEN_KEYS } from "./constants";
import { LineKey } from "./LineKey";
import { legendTooltip } from "./model";
import type { LegendItem } from "./types";
import { useSeriesLegend } from "./use-series-legend";
import styles from "./SeriesLegend.module.css";

export interface SeriesLegendProps {
  items: readonly LegendItem[];
  hidden?: readonly string[];
  onChange?: (hidden: string[]) => void;
  missingLabel?: string;
  className?: string;
}

export function SeriesLegend({ items, hidden = NO_HIDDEN_KEYS, onChange, missingLabel = LEGEND_LABELS.missing, className }: SeriesLegendProps) {
  const legend = useSeriesLegend(items, hidden, onChange);
  return (
    <div className={cx(styles.legend, className)}>
      {items.map((item) => {
        const active = legend.isActive(item.key);
        return (
          <Tooltip key={item.key} label={legendTooltip(item)}>
            <button
              type="button"
              className={cx(styles.toggle, active && styles.active)}
              aria-pressed={active}
              aria-label={item.label}
              onClick={() => legend.toggle(item.key)}
            >
              <LineKey color={item.color} dash={item.dash} className={styles.key} />
              <span className={styles.label}>{item.label}</span>
              <span className={styles.value}>{item.value ?? missingLabel}</span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
