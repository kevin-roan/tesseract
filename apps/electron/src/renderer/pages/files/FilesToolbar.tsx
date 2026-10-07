import { AnimatePresence, motion } from "motion/react";
import { ChoiceDropdown } from "../../components/ChoiceDropdown";
import { PillTabs, type PillTab } from "../../components/PillTabs";
import type { FileView } from "../../features/files/constants";
import type { FilterState } from "../../features/files/hooks/use-files-page";
import { FILES_LABELS } from "../../features/files/labels";
import { fade } from "../../theme/motion";
import styles from "./FilesPage.module.css";

export interface FilesToolbarProps {
  view: FileView;
  tabs: PillTab[];
  onView(view: string): void;
  projectFilter: FilterState;
  sourceFilter: FilterState;
  outputFilter: FilterState;
}

function Filter({ filter, tooltip }: { filter: FilterState; tooltip: string }) {
  return <ChoiceDropdown variant="toolbar" options={filter.options} value={filter.value} onChange={filter.onChange} tooltip={tooltip} />;
}

export function FilesToolbar({ view, tabs, onView, projectFilter, sourceFilter, outputFilter }: FilesToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarStart}>
        <PillTabs tabs={tabs} selected={view} onChange={onView} label={FILES_LABELS.view} />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={view} className={styles.toolbarEnd} variants={fade} initial="initial" animate="animate" exit="exit">
          {view === "shared" ? (
            <>
              <Filter filter={projectFilter} tooltip={FILES_LABELS.projectFilter} />
              <Filter filter={sourceFilter} tooltip={FILES_LABELS.sourceFilter} />
            </>
          ) : (
            <Filter filter={outputFilter} tooltip={FILES_LABELS.projectFilter} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
