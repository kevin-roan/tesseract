import { AnimatePresence, motion } from "motion/react";
import { IconButton } from "../../../components/IconButton";
import { PillTabs, type PillTab } from "../../../components/PillTabs";
import { SearchField } from "../../../components/SearchField";
import { PROJECTS_ICONS, SEARCH_DEBOUNCE_MS } from "../../../features/projects/constants";
import type { ProjectSearch } from "../../../features/projects/hooks/use-project-search";
import { PROJECTS_LABELS } from "../../../features/projects/labels";
import type { ListTab } from "../../../features/projects/types";
import { reveal } from "../../../theme/motion";
import styles from "./ProjectsList.module.css";

export interface ProjectsToolbarProps {
  tabs: readonly PillTab[];
  tab: ListTab;
  onTab(tab: ListTab): void;
  grouped: boolean;
  onToggleGrouped(): void;
  search: ProjectSearch;
}

export function ProjectsToolbar({ tabs, tab, onTab, grouped, onToggleGrouped, search }: ProjectsToolbarProps) {
  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.toolbarStart}>
          <PillTabs tabs={tabs} selected={tab} onChange={(id) => onTab(id as ListTab)} label={PROJECTS_LABELS.filter} />
        </div>
        <div className={styles.toolbarEnd}>
          <IconButton
            icon={PROJECTS_ICONS.filter}
            label={PROJECTS_LABELS.searchProjects}
            variant="bordered"
            checked={search.open}
            onClick={search.toggle}
          />
          <IconButton
            icon={PROJECTS_ICONS.group}
            label={PROJECTS_LABELS.groupByStatus}
            variant="bordered"
            checked={grouped}
            onClick={onToggleGrouped}
          />
        </div>
      </div>
      <AnimatePresence initial={false}>
        {search.open ? (
          <motion.div
            key="search"
            className={styles.searchReveal}
            variants={reveal}
            initial="initial"
            animate="animate"
            exit="exit"
            onKeyDownCapture={search.onFieldKeyDownCapture}
          >
            <SearchField
              className={styles.search}
              inputRef={search.inputRef}
              value={search.text}
              placeholder={PROJECTS_LABELS.searchProjects}
              debounceMs={SEARCH_DEBOUNCE_MS}
              onChange={search.setText}
              onSearch={search.search}
              onStop={search.stop}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
