import { motion } from "motion/react";
import type { OnboardingStepId } from "../../../shared/routes";
import { Text } from "../../components/Text";
import { cx } from "../../lib/cx";
import { RAIL_HIGHLIGHT_ID } from "./constants";
import { SHELL_LABELS } from "./labels";
import type { RailItem } from "./model";
import { RAIL_HIGHLIGHT_TRANSITION } from "./motion";
import { StatusGlyph } from "./StatusGlyph";
import styles from "./StepRail.module.css";

export interface StepRailProps {
  items: readonly RailItem[];
  version: string;
  onSelect(step: OnboardingStepId): void;
}

export function StepRail({ items, version, onSelect }: StepRailProps) {
  return (
    <nav className={cx(styles.rail, "to-drag")} aria-label={SHELL_LABELS.railLabel}>
      <Text variant="overline" color="text-secondary" className={styles.overline}>
        {SHELL_LABELS.setUp}
      </Text>
      <ol className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <button
              type="button"
              className={cx(styles.row, "to-no-drag", item.current && styles.current, !item.clickable && styles.locked)}
              aria-current={item.current ? "step" : undefined}
              aria-disabled={!item.clickable || undefined}
              data-status={item.status}
              tabIndex={item.clickable ? 0 : -1}
              onClick={() => {
                if (item.clickable && !item.current) onSelect(item.id);
              }}
            >
              {item.current ? (
                <motion.span layoutId={RAIL_HIGHLIGHT_ID} className={styles.highlight} transition={RAIL_HIGHLIGHT_TRANSITION} />
              ) : null}
              <StatusGlyph status={item.status} dimmed={!item.clickable} />
              <span className={styles.label}>{item.railLabel}</span>
              {item.optional ? <span className={styles.optional}>{SHELL_LABELS.optional}</span> : null}
            </button>
          </li>
        ))}
      </ol>
      <div className={styles.footer}>
        <Text variant="caption" color="text-tertiary">
          {SHELL_LABELS.version(version)}
        </Text>
      </div>
    </nav>
  );
}
