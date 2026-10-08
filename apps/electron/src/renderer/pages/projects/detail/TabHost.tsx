import { Suspense } from "react";
import { EmptyState } from "../../../components/EmptyState";
import { Crossfade } from "../../../components/Presence";
import type { TabHost as TabHostApi } from "../../../features/projects/hooks/use-tab-host";
import type { ProjectDetailState } from "../../../features/projects/hooks/use-project-detail";
import { DETAIL_LABELS } from "../../../features/projects/labels";
import type { ProjectTabId } from "../../../features/projects/types";
import type { AgentRun, Project } from "@tesseract/protocol";
import { findTabComponent } from "./tab-registry";
import styles from "./ProjectDetail.module.css";

export interface TabHostProps {
  tab: ProjectTabId;
  project: Project;
  state: ProjectDetailState;
  runs: readonly AgentRun[];
  host: TabHostApi;
  onSyncCount?(count: number): void;
}

export function TabHost({ tab, project, state, runs, host, onSyncCount }: TabHostProps) {
  const Component = findTabComponent(tab);
  return (
    <Crossfade id={tab} className={styles.tabContent}>
      {Component ? (
        <Suspense fallback={null}>
          <Component
            project={project}
            projectId={project.id}
            processes={state.processes}
            builds={state.builds}
            artifacts={state.artifacts}
            details={state.git}
            error={state.gitError}
            sessions={state.sessions}
            runs={runs}
            host={host}
            visible={host.visible}
            report={host.report}
            onCount={onSyncCount}
          />
        </Suspense>
      ) : (
        <EmptyState title={DETAIL_LABELS.tabUnavailable} icon={null} />
      )}
    </Crossfade>
  );
}
