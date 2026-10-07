import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useId, useRef, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Breadcrumb, useDialogBehavior } from "../../components/DialogShell";
import { cx } from "../../lib/cx";
import { fade } from "../../theme/motion";
import { PALETTE_LABELS } from "./labels";
import { PALETTE_SHEET_VARIANTS } from "./motion";
import { PaletteEmpty } from "./PaletteEmpty";
import { PaletteFooter } from "./PaletteFooter";
import { PaletteItem } from "./PaletteItem";
import { useActiveIntoView } from "./use-active-into-view";
import { useCommandPalette } from "./use-command-palette";
import { usePaletteContext } from "./use-palette-context";
import { usePaletteRouteParam } from "./use-palette-route-param";
import styles from "./CommandPalette.module.css";

type PaletteController = ReturnType<typeof useCommandPalette>;

export function CommandPalette() {
  usePaletteRouteParam();
  const palette = useCommandPalette();
  return createPortal(
    <AnimatePresence>{palette.open ? <PaletteLayer key="palette" palette={palette} /> : null}</AnimatePresence>,
    document.body,
  );
}

interface PaletteLayerProps {
  palette: PaletteController;
}

function PaletteLayer({ palette }: PaletteLayerProps) {
  const present = useIsPresent();
  const sheetRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const optionId = useId();
  const context = usePaletteContext();
  useDialogBehavior({ active: present, sheetRef, onClose: palette.close, initialFocus: inputRef });
  useActiveIntoView(listRef, palette.active, palette.source === "keyboard");

  const onBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) palette.close();
  };

  let offset = 0;
  return (
    <motion.div
      className={cx(styles.layer, "to-no-drag")}
      variants={fade}
      initial="initial"
      animate="animate"
      exit="exit"
      onMouseDown={onBackdrop}
      data-command-palette=""
    >
      <motion.div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal
        aria-label={PALETTE_LABELS.dialog}
        tabIndex={-1}
        variants={PALETTE_SHEET_VARIANTS}
      >
        {context ? (
          <div className={styles.header}>
            <Breadcrumb title={PALETTE_LABELS.dialog} context={{ label: context.title, icon: context.icon }} />
          </div>
        ) : null}
        <div className={styles.inputRow}>
          <input
            ref={inputRef}
            className={styles.input}
            value={palette.query}
            placeholder={PALETTE_LABELS.placeholder}
            onChange={(event) => palette.setQuery(event.target.value)}
            onKeyDown={palette.onKeyDown}
            role="combobox"
            aria-label={PALETTE_LABELS.placeholder}
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={palette.active >= 0 ? `${optionId}-${palette.active}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div ref={listRef} id={listId} className={styles.list} role="listbox" aria-label={PALETTE_LABELS.results}>
          {palette.sections.length === 0 ? <PaletteEmpty query={palette.query} /> : null}
          {palette.sections.map((section) => {
            const start = offset;
            offset += section.results.length;
            return (
              <div key={section.group} role="group" aria-label={section.group} className={styles.group}>
                <div className={styles.groupLabel} aria-hidden>
                  {section.group}
                </div>
                {section.results.map((result, position) => {
                  const index = start + position;
                  return (
                    <PaletteItem
                      key={result.command.id}
                      id={`${optionId}-${index}`}
                      index={index}
                      result={result}
                      active={index === palette.active}
                      onHover={palette.hover}
                      onSelect={palette.select}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
        <PaletteFooter />
      </motion.div>
    </motion.div>
  );
}
