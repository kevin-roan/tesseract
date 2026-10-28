import type { Project } from "@tesseract/protocol";
import { EmptyState } from "../../../../components/EmptyState";
import { CrossfadeStack } from "../../../../components/Section";
import { Spinner } from "../../../../components/Spinner";
import { Text } from "../../../../components/Text";
import { describeError } from "../../../../app/connection";
import type { TabHost } from "../../../../features/projects/hooks/use-tab-host";
import { EMPTY_ICON } from "./constants";
import { CreateIssueDialog } from "./CreateIssueDialog";
import { useIssuesTab } from "./hooks/use-issues-tab";
import { IssueBoard } from "./IssueBoard";
import { IssueList } from "./IssueList";
import { IssueSheet } from "./IssueSheet";
import { IssuesToolbar } from "./IssuesToolbar";
import { ISSUES_LABELS as L } from "./labels";
import styles from "./IssuesTab.module.css";

export interface IssuesTabProps {
  project: Project;
  host: TabHost;
}

export function IssuesTab({ project, host }: IssuesTabProps) {
  const tab = useIssuesTab({ projectId: project.id, host });
  const openCreate = () => tab.openCreate();
  return (
    <div ref={tab.rootRef} className={styles.root}>
      <IssuesToolbar scope={tab.scope} layout={tab.layout} onScope={tab.setScope} onLayout={tab.setLayout} onCreate={openCreate} />
      <CrossfadeStack view={tab.view}>
        {tab.view === "loading" ? (
          <div className={styles.placeholder}>
            <Spinner size={24} label={L.loading} />
          </div>
        ) : tab.view === "error" ? (
          <EmptyState icon="warning" title={L.loadFailed} message={describeError(tab.error)} actionLabel={L.tryAgain} onAction={tab.refresh} />
        ) : tab.view === "empty" ? (
          <EmptyState icon={EMPTY_ICON} title={L.emptyTitle} message={L.emptyMessage} actionLabel={L.newIssue} onAction={openCreate} />
        ) : (
          <>
            {tab.visible.length === 0 ? (
              <Text variant="body" color="text-tertiary" className={styles.noMatches}>
                {L.noMatches}
              </Text>
            ) : null}
            {tab.layout === "board" ? (
              <IssueBoard columns={tab.columns} drag={tab.drag} onOpen={tab.select} onCreate={tab.openCreate} />
            ) : (
              <IssueList columns={tab.columns} onOpen={tab.select} onCreate={tab.openCreate} />
            )}
          </>
        )}
      </CrossfadeStack>
      <CreateIssueDialog
        open={tab.createOpen}
        projectName={project.name || project.id}
        initialStatus={tab.createStatus}
        labelSuggestions={tab.labels}
        onCreate={tab.create}
        onClose={tab.closeCreate}
      />
      <IssueSheet issue={tab.selected} labelSuggestions={tab.labels} actions={tab.actions} onClose={tab.closeSheet} onViewRun={tab.viewRun} />
    </div>
  );
}
