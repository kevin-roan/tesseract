import { useMemo } from "react";
import { Crossfade } from "../../../components/Presence";
import { PROJECTS_ICONS } from "../../../features/projects/constants";
import { useProjectsListPage } from "../../../features/projects/hooks/use-projects-list-page";
import { PROJECTS_LABELS } from "../../../features/projects/labels";
import { usePageHeader } from "../../../shell/header-store";
import { HeaderActions } from "../HeaderActions";
import { ListState } from "./ListState";
import { ProjectSections } from "./ProjectSections";
import { ProjectsToolbar } from "./ProjectsToolbar";
import styles from "./ProjectsList.module.css";

export interface ProjectsListProps {
  onOpen(id: string): void;
  onAsk(id?: string): void;
  onCreate(): void;
}

export function ProjectsList({ onOpen, onAsk, onCreate }: ProjectsListProps) {
  const page = useProjectsListPage({ onAsk, onCreate });
  const { view, refresh } = page.list;
  const actions = useMemo(
    () => (
      <HeaderActions
        items={[
          { id: "refresh", icon: PROJECTS_ICONS.refresh, label: PROJECTS_LABELS.refresh, onClick: refresh },
          { id: "add", icon: PROJECTS_ICONS.add, label: PROJECTS_LABELS.newProject, onClick: onCreate },
        ]}
      />
    ),
    [refresh, onCreate],
  );
  usePageHeader({ title: PROJECTS_LABELS.title, actions });
  const stateKey = view.state ? `state:${view.state.title}` : "content";
  const content = (
      <div ref={page.search.rootRef} className={styles.root}>
        <ProjectsToolbar
          tabs={page.tabs}
          tab={page.list.tab}
          onTab={page.list.setTab}
          grouped={page.list.grouped}
          onToggleGrouped={page.list.toggleGrouped}
          search={page.search}
        />
        <div className={styles.scroller}>
          <div className={styles.groups}>
            <ProjectSections groups={view.groups} showHeadings={view.grouped} onOpen={onOpen} onAsk={onAsk} />
            {view.noMatch ? <ListState state={view.noMatch} onAction={page.onAction} /> : null}
          </div>
        </div>
      </div>
  );
  return (
    <Crossfade id={stateKey} className={styles.state}>
      {view.state ? <ListState state={view.state} onAction={page.onAction} /> : content}
    </Crossfade>
  );
}
