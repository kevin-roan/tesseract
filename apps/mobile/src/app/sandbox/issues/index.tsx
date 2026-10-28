import { useLocalSearchParams } from "expo-router";
import { KanbanIcon, WarningIcon } from "phosphor-react-native";

import EmptyState from "@/components/empty-state";
import Notice from "@/components/notice";
import OptionSheet from "@/components/option-sheet";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import SegmentedPills from "@/components/segmented-pills";
import { SkeletonList } from "@/components/skeleton";
import { ThemedText } from "@/components/themed-text";
import CreateIssueSheet from "@/features/issues/components/create-issue-sheet";
import IssueGroup from "@/features/issues/components/issue-group";
import { useProjectIssuesScreen } from "@/features/issues/hooks/use-project-issues-screen";
import { ISSUES_COPY } from "@/features/issues/utils/content";
import { FILTER_SEGMENTS } from "@/features/issues/utils/options";
import { firstParam } from "@/features/sandbox/utils/routes";

export default function ProjectIssuesScreen() {
  const params = useLocalSearchParams<{ projectId: string }>();
  const screen = useProjectIssuesScreen(firstParam(params.projectId) ?? "");
  const offsets = screen.groups.map((_, index) =>
    screen.groups.slice(0, index).reduce((total, group) => total + group.issues.length, 0),
  );

  return (
    <ScreenScaffold
      refreshing={screen.refreshing}
      onRefresh={screen.refresh}
      testID="issues-screen"
      header={
        <ScreenHeader
          title={ISSUES_COPY.title}
          subtitle={screen.projectName}
          onBack={screen.back}
          actions={screen.headerActions}
        />
      }
    >
      {screen.loading ? (
        <SkeletonList count={4} height={72} radius="card" />
      ) : screen.error ? (
        <Notice
          tone="danger"
          icon={WarningIcon}
          title={ISSUES_COPY.failedTitle}
          message={screen.error}
          actionLabel={ISSUES_COPY.retry}
          onAction={screen.retry}
        />
      ) : screen.total === 0 ? (
        <EmptyState
          icon={KanbanIcon}
          title={ISSUES_COPY.emptyTitle}
          message={ISSUES_COPY.emptyMessage}
          actionLabel={ISSUES_COPY.newIssue}
          onAction={screen.newIssue}
        />
      ) : (
        <>
          <SegmentedPills options={FILTER_SEGMENTS} value={screen.filter} onChange={screen.setFilter} label={ISSUES_COPY.filterLabel} />
          {screen.actionError ? <Notice tone="danger" message={screen.actionError} /> : null}
          {screen.groups.length === 0 ? (
            <ThemedText variant="bodySmall" color="textSecondary" testID="issues-filter-empty">
              {ISSUES_COPY.emptyFiltered}
            </ThemedText>
          ) : (
            screen.groups.map((group, index) => (
              <IssueGroup
                key={group.status}
                group={group}
                collapsed={screen.isCollapsed(group.status)}
                onToggle={() => screen.toggleGroup(group.status)}
                onOpen={(issue) => screen.open(issue.id)}
                onLongPress={screen.changeStatus}
                indexOffset={offsets[index]}
              />
            ))
          )}
        </>
      )}
      <OptionSheet {...screen.statusSheet} testID="issue-status-sheet" />
      <CreateIssueSheet state={screen.form} />
    </ScreenScaffold>
  );
}
