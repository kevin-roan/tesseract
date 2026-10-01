import { InfoIcon, SparkleIcon } from "phosphor-react-native";

import EmptyState from "@/components/empty-state";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import ClaudeStatusCard from "@/features/claude-account/components/claude-status-card";
import { useClaudeAccountScreen } from "@/features/claude-account/hooks/use-claude-account-screen";

export default function ClaudeAccountScreen() {
  const screen = useClaudeAccountScreen();

  return (
    <ScreenScaffold
      refreshing={screen.refreshing}
      onRefresh={screen.refresh}
      header={<ScreenHeader title="Claude account" subtitle="Claude Code sign-in for this sandbox" onBack={screen.back} />}
    >
      {screen.view ? (
        <ClaudeStatusCard view={screen.view} />
      ) : screen.error ? (
        <EmptyState
          icon={SparkleIcon}
          title="Couldn't check the Claude sign-in"
          message={screen.error}
          actionLabel="Try again"
          onAction={screen.retry}
        />
      ) : (
        <EmptyState loading title="Checking Claude sign-in…" />
      )}

      <Notice
        tone="info"
        icon={InfoIcon}
        title="Credentials come from the host"
        message="Claude in the sandbox uses the login in the host machine's ~/.claude folder, which is linked into the sandbox. To sign in or switch accounts, run claude on the host machine, then pull to refresh."
      />
    </ScreenScaffold>
  );
}
