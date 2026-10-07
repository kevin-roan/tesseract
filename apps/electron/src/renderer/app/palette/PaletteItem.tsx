import { motion } from "motion/react";
import type { MouseEvent } from "react";
import { Icon } from "../../components/Icon";
import { Kbd } from "../../components/Kbd";
import { cx } from "../../lib/cx";
import { PALETTE_HIGHLIGHT_LAYOUT_ID } from "./constants";
import { HighlightedText } from "./HighlightedText";
import { PALETTE_HIGHLIGHT_TRANSITION } from "./motion";
import type { PaletteResult } from "./types";
import styles from "./CommandPalette.module.css";

export interface PaletteItemProps {
  id: string;
  index: number;
  result: PaletteResult;
  active: boolean;
  onHover(index: number): void;
  onSelect(index: number): void;
}

const keepInputFocus = (event: MouseEvent) => event.preventDefault();

export function PaletteItem({ id, index, result, active, onHover, onSelect }: PaletteItemProps) {
  const { command, ranges } = result;
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      data-index={index}
      className={cx(styles.item, active && styles.active)}
      onPointerMove={active ? undefined : () => onHover(index)}
      onMouseDown={keepInputFocus}
      onClick={() => onSelect(index)}
    >
      {active ? (
        <motion.span
          layoutId={PALETTE_HIGHLIGHT_LAYOUT_ID}
          className={styles.highlight}
          transition={PALETTE_HIGHLIGHT_TRANSITION}
          aria-hidden
        />
      ) : null}
      {command.icon || command.glyph ? (
        <Icon name={command.icon} icon={command.glyph} className={styles.itemIcon} />
      ) : (
        <span className={styles.itemIcon} />
      )}
      <span className={styles.itemTitle}>
        <HighlightedText text={command.title} ranges={ranges} />
      </span>
      {command.subtitle ? <span className={styles.itemSubtitle}>{command.subtitle}</span> : null}
      {command.shortcut ? <Kbd keys={command.shortcut} size="sm" className={styles.itemShortcut} /> : null}
    </div>
  );
}
