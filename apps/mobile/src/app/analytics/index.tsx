import { ChartBarIcon, WarningIcon } from "phosphor-react-native";

import ChoiceGroup from "@/components/choice-group";
import EmptyState from "@/components/empty-state";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import StatGrid from "@/components/stat-grid";
import AnalyticsOverview from "@/features/analytics/components/analytics-overview";
import AnalyticsSkeleton from "@/features/analytics/components/skeleton";
import { useAnalyticsOverview } from "@/features/analytics/hooks/use-analytics-overview";
import { useAnalyticsScreen } from "@/features/analytics/hooks/use-analytics-screen";
import UsageHero from "@/features/home/components/usage-hero";
import SandboxGate from "@/features/sandbox/components/sandbox-gate";

export default function AnalyticsScreen() {
  const screen = useAnalyticsScreen();
  const overview = useAnalyticsOverview();

  if (!screen.sandbox) {
    return <SandboxGate />;
  }

  return (
    <ScreenScaffold
      refreshing={screen.refreshing}
      onRefresh={screen.refresh}
      header={<ScreenHeader title="Analytics" subtitle={screen.sandbox.name} onBack={screen.nav.back} />}
    >
      <StatGrid items={overview.stats} />

      <UsageHero
        range={overview.usage.range}
        ranges={overview.usage.ranges}
        onChangeRange={overview.usage.setRange}
        data={overview.usage.data}
        loading={overview.usage.loading}
        error={overview.usage.error}
        onRetry={overview.usage.retry}
      />

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
      ) : screen.empty ? (
        <EmptyState
          icon={ChartBarIcon}
          title="No usage yet"
          message="Token usage shows up here once Claude replies in this sandbox, from agent runs, terminals or the CLI."
          actionLabel="Start an agent run"
          onAction={screen.nav.newAgentRun}
        />
      ) : screen.view ? (
        <AnalyticsOverview
          view={screen.view}
          stale={screen.stale}
          onProject={screen.openProject}
          sessionPress={screen.nav.sessionPress}
          sessionsLoading={screen.sessionsLoading}
          sessionsError={screen.sessionsError}
          onRetrySessions={screen.retrySessions}
        />
      ) : null}
    </ScreenScaffold>
  );
}
