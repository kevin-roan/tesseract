import { ChartBarIcon, WarningIcon } from "phosphor-react-native";
import { useLocalSearchParams } from "expo-router";

import ChoiceGroup from "@/components/choice-group";
import EmptyState from "@/components/empty-state";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import ProjectOverview from "@/features/analytics/components/project-overview";
import AnalyticsSkeleton from "@/features/analytics/components/skeleton";
import { useProjectAnalytics } from "@/features/analytics/hooks/use-project-analytics";
import SandboxGate from "@/features/sandbox/components/sandbox-gate";

export default function ProjectAnalyticsScreen() {
  const params = useLocalSearchParams<{ id: string; days?: string }>();
  const screen = useProjectAnalytics(String(params.id ?? ""), params.days);

  if (!screen.sandbox) {
    return <SandboxGate />;
  }

  return (
    <ScreenScaffold
      refreshing={screen.refreshing}
      onRefresh={screen.refresh}
      header={<ScreenHeader title={screen.title} subtitle="Project usage" onBack={screen.nav.back} />}
    >
      <ChoiceGroup
        options={screen.range.options}
        selectedId={String(screen.range.days)}
        onSelect={screen.range.select}
        label="Time range"
      />

      {screen.error ? (
        <Notice
          tone="danger"
          icon={WarningIcon}
          title="Usage didn't load"
          message={screen.error}
          actionLabel="Retry"
          onAction={screen.retry}
        />
      ) : null}

      {screen.loading ? (
        <AnalyticsSkeleton />
      ) : screen.view && !screen.view.hasUsage && !screen.stale ? (
        <EmptyState
          icon={ChartBarIcon}
          title="No usage in this range"
          message="Claude hasn't replied in this project during the selected days. Try a longer range."
        />
      ) : screen.view ? (
        <ProjectOverview
          view={screen.view}
          days={screen.range.days}
          stale={screen.stale}
          sessionPress={screen.nav.sessionPress}
          sessionsLoading={screen.sessionsLoading}
          sessionsError={screen.sessionsError}
          onRetrySessions={screen.retrySessions}
        />
      ) : null}
    </ScreenScaffold>
  );
}
