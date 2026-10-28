import { useLocalSearchParams } from "expo-router";
import { KanbanIcon } from "phosphor-react-native";

import EmptyState from "@/components/empty-state";
import MotionItem from "@/components/motion-item";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import ComposerBar from "@/features/chat/components/composer-bar";
import IssueActivity from "@/features/issues/components/issue-activity";
import IssueClaudePanel from "@/features/issues/components/issue-claude-panel";
import IssueEditor from "@/features/issues/components/issue-editor";
import IssueLabelsSheet from "@/features/issues/components/issue-labels-sheet";
import IssueProperties from "@/features/issues/components/issue-properties";
import { useIssueDetailScreen } from "@/features/issues/hooks/use-issue-detail-screen";
import { ISSUE_DETAIL_COPY } from "@/features/issues/utils/content";
import { firstParam } from "@/features/sandbox/utils/routes";

export default function IssueScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const screen = useIssueDetailScreen(firstParam(params.id) ?? "");
  const { issue, composer } = screen;
  const header = <ScreenHeader title={screen.identifier} onBack={screen.back} actions={screen.headerActions} />;

  if (!issue) {
    return (
      <ScreenScaffold header={header}>
        {screen.missing ? (
          <EmptyState icon={KanbanIcon} title={ISSUE_DETAIL_COPY.missingTitle} message={ISSUE_DETAIL_COPY.missingMessage} />
        ) : screen.error ? (
          <EmptyState
            icon={KanbanIcon}
            title={ISSUE_DETAIL_COPY.failedTitle}
            message={screen.error}
            actionLabel={ISSUE_DETAIL_COPY.retry}
            onAction={screen.retry}
          />
        ) : (
          <EmptyState loading title={ISSUE_DETAIL_COPY.loading} />
        )}
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      avoidKeyboard
      refreshing={screen.refreshing}
      onRefresh={screen.refresh}
      testID="issue-screen"
      header={header}
      footer={
        <ComposerBar
          value={composer.text}
          onChangeText={composer.setText}
          placeholder={composer.placeholder}
          primary="send"
          onPrimary={composer.send}
          primaryDisabled={!composer.canSend}
          busy={composer.sending}
          sendLabel={ISSUE_DETAIL_COPY.send}
          testID="issue-composer"
        />
      }
    >
      <MotionItem index={0}>
        <IssueEditor issue={issue} identifier={screen.identifier} title={screen.title} description={screen.description} />
      </MotionItem>
      {screen.actionError ? <Notice tone="danger" message={screen.actionError} /> : null}
      <MotionItem index={1}>
        <IssueClaudePanel claude={screen.claude} />
      </MotionItem>
      <MotionItem index={2}>
        <IssueProperties properties={screen.properties} />
      </MotionItem>
      <MotionItem index={3}>
        <IssueActivity comments={screen.comments} loading={screen.commentsLoading} onOpenRun={screen.openRun} />
      </MotionItem>
      {composer.error ? <Notice tone="danger" message={composer.error} /> : null}
      <IssueLabelsSheet state={screen.labelsSheet} />
    </ScreenScaffold>
  );
}
