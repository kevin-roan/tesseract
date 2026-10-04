import { InfoIcon, SparkleIcon, UsersIcon } from "phosphor-react-native";

import EmptyState from "@/components/empty-state";
import MotionItem from "@/components/motion-item";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import Section from "@/components/section";
import ClaudeAccountList from "@/features/claude-account/components/claude-account-list";
import ClaudeStatusCard from "@/features/claude-account/components/claude-status-card";
import { useClaudeAccountScreen } from "@/features/claude-account/hooks/use-claude-account-screen";
import { CLAUDE_ACCOUNTS_COPY } from "@/features/claude-account/utils/accounts";

export default function ClaudeAccountScreen() {
  const screen = useClaudeAccountScreen();

  return (
    <ScreenScaffold
      refreshing={screen.refreshing}
      onRefresh={screen.refresh}
      header={
        <ScreenHeader
          title={CLAUDE_ACCOUNTS_COPY.screenTitle}
          subtitle={CLAUDE_ACCOUNTS_COPY.screenSubtitle}
          onBack={screen.back}
        />
      }
    >
      <MotionItem index={0}>
        <Section title={CLAUDE_ACCOUNTS_COPY.accountsTitle} loading={screen.accountsLoading} testID="claude-accounts-section">
          {screen.defaultError ? <Notice tone="danger" message={screen.defaultError} /> : null}
          {screen.accounts ? (
            <ClaudeAccountList
              rows={screen.accounts}
              onSelect={screen.selectDefault}
              footnote={CLAUDE_ACCOUNTS_COPY.accountsFootnote}
            />
          ) : screen.accountsUnsupported ? (
            <Notice tone="warning" icon={InfoIcon} message={CLAUDE_ACCOUNTS_COPY.unsupported} />
          ) : screen.accountsError ? (
            <EmptyState
              icon={UsersIcon}
              title={CLAUDE_ACCOUNTS_COPY.accountsFailed}
              message={screen.accountsError}
              actionLabel={CLAUDE_ACCOUNTS_COPY.retry}
              onAction={screen.retryAccounts}
            />
          ) : null}
        </Section>
      </MotionItem>

      <MotionItem index={1}>
        <Section title={CLAUDE_ACCOUNTS_COPY.statusTitle}>
          {screen.view ? (
            <ClaudeStatusCard view={screen.view} />
          ) : screen.error ? (
            <EmptyState
              icon={SparkleIcon}
              title={CLAUDE_ACCOUNTS_COPY.statusFailed}
              message={screen.error}
              actionLabel={CLAUDE_ACCOUNTS_COPY.retry}
              onAction={screen.retry}
            />
          ) : (
            <EmptyState loading title={CLAUDE_ACCOUNTS_COPY.statusLoading} />
          )}
        </Section>
      </MotionItem>

      <MotionItem index={2}>
        <Notice
          tone="info"
          icon={InfoIcon}
          title={CLAUDE_ACCOUNTS_COPY.hostTitle}
          message={CLAUDE_ACCOUNTS_COPY.hostMessage}
        />
      </MotionItem>
    </ScreenScaffold>
  );
}
