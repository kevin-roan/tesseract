import { AnimatedList, AnimatedListItem } from "../AnimatedList";
import { Crossfade } from "../Presence";
import type { SidebarProjectItem, SidebarProjectsState } from "./model";
import { projectKey } from "./model";
import { SidebarProjectRow } from "./SidebarProjectRow";
import { SidebarRunList } from "./SidebarRunList";
import { SidebarStatus } from "./SidebarStatus";
import { useProjectExpansion } from "./use-project-expansion";
import styles from "./Sidebar.module.css";

export interface SidebarProjectsLabels {
  loading: string;
  offline: string;
  empty: string;
  createProject: string;
}

export interface SidebarProjectsProps {
  state: SidebarProjectsState;
  items: readonly SidebarProjectItem[];
  labels: SidebarProjectsLabels;
  onOpenProject?: (id: string) => void;
  onNewConversation?: (id: string | null) => void;
  onOpenRun?: (id: string) => void;
  onCreateProject?: () => void;
}

export function SidebarProjects({ state, items, labels, onOpenProject, onNewConversation, onOpenRun, onCreateProject }: SidebarProjectsProps) {
  const expansion = useProjectExpansion(items);
  return (
    <Crossfade id={state} speed="fast">
      {state === "loading" ? <SidebarStatus loading message={labels.loading} /> : null}
      {state === "offline" ? <SidebarStatus message={labels.offline} /> : null}
      {state === "empty" ? <SidebarStatus message={labels.empty} actionLabel={labels.createProject} onAction={onCreateProject} /> : null}
      {state === "ready" ? (
        <AnimatedList gap={1} className={styles.projectList}>
          {items.map((item) => {
            const id = item.id;
            return (
              <AnimatedListItem key={projectKey(id)}>
                <SidebarProjectRow
                  name={item.name}
                  tint={item.tint}
                  unassigned={id === null}
                  confidential={item.confidential}
                  running={item.running}
                  expanded={expansion.isExpanded(id)}
                  onOpen={id !== null && onOpenProject ? () => onOpenProject(id) : undefined}
                  onNew={onNewConversation ? () => onNewConversation(id) : undefined}
                  onToggle={() => expansion.toggle(id)}
                >
                  <SidebarRunList runs={item.runs} onOpenRun={onOpenRun} />
                </SidebarProjectRow>
              </AnimatedListItem>
            );
          })}
        </AnimatedList>
      ) : null}
    </Crossfade>
  );
}
