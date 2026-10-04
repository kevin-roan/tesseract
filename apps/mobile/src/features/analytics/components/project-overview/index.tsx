import { useMemo } from "react";
import { View } from "react-native";
import type { ClaudeSession } from "@theone/protocol";

import MotionItem from "@/components/motion-item";
import Notice from "@/components/notice";
import Section from "@/components/section";
import { useAppTheme } from "@/hooks/use-app-theme";

import { useTokenSeries } from "../../hooks/use-chart-colors";
import { formatCompact, rangeLabel } from "../../utils/format";
import type { ProjectView } from "../../utils/project-view";
import ActivityCard from "../activity-card";
import ChartCard from "../chart-card";
import KpiGrid from "../kpi-grid";
import SessionList from "../session-list";
import TokenMixBar from "../token-mix-bar";
import createStyles from "../analytics-overview/styles";

export type ProjectOverviewProps = {
  view: ProjectView;
  days: number;
  stale?: boolean;
  sessionPress: (session: ClaudeSession) => (() => void) | undefined;
  sessionsLoading?: boolean;
  sessionsError?: string | null;
  onRetrySessions?: () => void;
};

const ProjectOverview = ({
  view,
  days,
  stale = false,
  sessionPress,
  sessionsLoading = false,
  sessionsError = null,
  onRetrySessions,
}: ProjectOverviewProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const series = useTokenSeries();
  const title = rangeLabel(days);

  return (
    <View style={[styles.overview, stale && styles.stale]} testID="project-overview">
      <KpiGrid items={view.kpis} testID="project-kpis" />

      <MotionItem index={1}>
        <ChartCard title="Token mix" subtitle="How this project's tokens split by kind.">
          <TokenMixBar title={title} series={series} values={view.tokenMix} formatValue={formatCompact} testID="token-mix" />
        </ChartCard>
      </MotionItem>

      <MotionItem index={2}>
        <Section title="Activity" testID="project-activity">
          <ActivityCard heatmap={view.heatmap} sample={view.heatmapSample} rangeTitle={title} />
        </Section>
      </MotionItem>

      <MotionItem index={3}>
        <Section
          title="Sessions"
          testID="project-sessions-section"
          isEmpty={!sessionsLoading && !sessionsError && view.sessions.length === 0}
          emptyLabel="No sessions in this project were active in this range."
        >
          {sessionsError ? (
            <Notice tone="danger" message={sessionsError} actionLabel="Retry" onAction={onRetrySessions} />
          ) : (
            <SessionList
              sessions={view.sessions}
              onPress={sessionPress}
              caption="Ranked by each session's lifetime tokens."
              testID="project-sessions"
            />
          )}
        </Section>
      </MotionItem>
    </View>
  );
};

export default ProjectOverview;
