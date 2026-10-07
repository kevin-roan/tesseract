import { motion } from "motion/react";
import type { KeyboardEvent } from "react";
import type { PreferencesSectionId } from "../../../shared/routes";
import type { PreferencesSectionDefinition } from "../../app/define";
import { Icon } from "../../components/Icon";
import { Text } from "../../components/Text";
import { cx } from "../../lib/cx";
import { navHighlight } from "./motion";
import { NAV_SELECTION_LAYOUT_ID } from "./constants";
import styles from "./PreferencesDialog.module.css";

export interface PreferencesNavProps {
  title: string;
  sections: readonly PreferencesSectionDefinition[];
  selected: PreferencesSectionId;
  onSelect(id: PreferencesSectionId): void;
  onKeyDown(event: KeyboardEvent<HTMLElement>): void;
}

export function PreferencesNav({ title, sections, selected, onSelect, onKeyDown }: PreferencesNavProps) {
  return (
    <nav className={cx(styles.nav, "to-no-drag")} aria-label={title}>
      <Text variant="overline" color="text-secondary" className={styles.overline}>
        {title}
      </Text>
      <div className={styles.navList} role="tablist" aria-orientation="vertical" onKeyDown={onKeyDown}>
        {sections.map((item) => {
          const active = item.id === selected;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              data-section={item.id}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              className={cx(styles.navRow, active && styles.selected)}
              onClick={() => onSelect(item.id)}
            >
              {active ? <motion.span layoutId={NAV_SELECTION_LAYOUT_ID} className={styles.navHighlight} transition={navHighlight} /> : null}
              <Icon name={item.icon} className={styles.navIcon} />
              <Text variant="label" className={styles.navLabel}>
                {item.title}
              </Text>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
