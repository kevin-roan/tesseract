import { motion } from "motion/react";
import { Suspense } from "react";
import type { PreferencesSectionDefinition } from "../../app/define";
import { sectionSwitch } from "./motion";
import styles from "./PreferencesDialog.module.css";

export function SectionPane({ section, active }: { section: PreferencesSectionDefinition; active: boolean }) {
  const Content = section.component;
  return (
    <motion.div
      role="tabpanel"
      aria-label={section.title}
      hidden={!active}
      className={styles.pane}
      variants={sectionSwitch}
      initial={false}
      animate={active ? "shown" : "hidden"}
    >
      <Suspense fallback={null}>
        <Content />
      </Suspense>
    </motion.div>
  );
}
