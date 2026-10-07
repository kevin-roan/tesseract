import { AnimatePresence, motion } from "motion/react";
import { Icon } from "../../components/Icon";
import { IconButton } from "../../components/IconButton";
import { Text } from "../../components/Text";
import { ToastHost } from "../../components/Toast";
import { dialog, fade } from "../../theme/motion";
import { PREFERENCES_TOAST_SCOPE } from "./constants";
import { PREFERENCES_LABELS } from "./labels";
import { PreferencesNav } from "./PreferencesNav";
import { SectionPane } from "./SectionPane";
import { SHEET_STYLE } from "./sheet-style";
import { usePreferencesDialog } from "./use-preferences-dialog";
import styles from "./PreferencesDialog.module.css";

export function PreferencesDialog() {
  const { open, current, sections, select, close, onNavKeyDown, bodyRef, sheetRef } = usePreferencesDialog();
  return (
    <AnimatePresence>
      {open && current ? (
        <motion.div key="preferences" className={styles.backdrop} variants={fade} initial="initial" animate="animate" exit="exit" onMouseDown={close}>
          <motion.div
            ref={sheetRef}
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-label={PREFERENCES_LABELS.title}
            className={styles.sheet}
            style={SHEET_STYLE}
            variants={dialog}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <PreferencesNav title={PREFERENCES_LABELS.title} sections={sections} selected={current.id} onSelect={select} onKeyDown={onNavKeyDown} />
            <section className={styles.content}>
              <header className={styles.header}>
                <div className={styles.breadcrumb}>
                  <Icon name="settings" color="text-secondary" />
                  <Text variant="bodyStrong" color="text-secondary">
                    {PREFERENCES_LABELS.title}
                  </Text>
                  <Icon name="caret-right" color="text-tertiary" />
                  <Text variant="bodyStrong">{current.title}</Text>
                </div>
                <IconButton icon="close" label={PREFERENCES_LABELS.close} size={24} className={styles.close} onClick={close} />
              </header>
              <div ref={bodyRef} className={styles.body}>
                {sections.map((section) => (
                  <SectionPane key={section.id} section={section} active={section.id === current.id} />
                ))}
              </div>
              <ToastHost scope={PREFERENCES_TOAST_SCOPE} />
            </section>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
