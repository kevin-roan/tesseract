import { useMemo } from "react";
import { View } from "react-native";
import type { ClaudeSession } from "@theone/protocol";

import Notice from "@/components/notice";
import Section from "@/components/section";
import { useAppTheme } from "@/hooks/use-app-theme";

import { useChartColors } from "../../hooks/use-chart-colors";
import type { BarItem } from "../../types";
import { rangeLabel } from "../../utils/format";
import type { AnalyticsView } from "../../utils/view-model";
import ActivityCard from "../activity-card";
import BarList from "../bar-list";
import Headline from "../headline";
import KpiGrid from "../kpi-grid";
import SessionList from "../session-list";
import TokensCard from "../tokens-card";
import createStyles from "./styles";

export type AnalyticsOverviewProps = {
  view: AnalyticsView;
  stale?: boolean;
  onProject: (projectId: string) => void;
  sessionPress: (session: ClaudeSession) => (() => void) | undefined;
  sessionsLoading?: boolean;
  sessionsError?: string | null;
  onRetrySessions?: () => void;
};

const AnalyticsOverview = ({
  view,
  stale = false,
  onProject,
  sessionPress,
  sessionsLoading = false,
  sessionsError = null,
  onRetrySessions,
}: AnalyticsOverviewProps) => {
  const theme = useAppTheme();
  const colors = useChartColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const title = rangeLabel(view.days);

  const projects = useMemo<BarItem[]>(
    () =>
      view.projects.map(({ projectId, ...item }) =>
        projectId ? { ...item, onPress: () => onProject(projectId) } : item,
      ),
    [view.projects, onProject],
  );

  return (
    <View style={[styles.overview, stale && styles.stale]} testID="analytics-overview">
      <View style={styles.lead}>
        <Headline label={`Tokens, ${title.toLowerCase()}`} headline={view.headline} testID="analytics-headline" />
        <TokensCard buckets={view.tokenBuckets} bucketSize={view.bucketSize} rangeTitle={title} />
      </View>

      <KpiGrid items={view.kpis} testID="analytics-kpis" />

      <Section
        title="By model"
        testID="models-section"
        isEmpty={view.models.length === 0}
        emptyLabel="No model replies in this range."
      >
        <BarList items={view.models} color={colors.categorical[0]} testID="models" />
      </Section>

      <Section
        title="By project"
        testID="projects-section"
        isEmpty={projects.length === 0}
        emptyLabel="No project usage in this range."
      >
        <BarList items={projects} color={colors.categorical[0]} testID="projects" />
      </Section>

      <Section title="Activity" testID="activity-section">
        <ActivityCard
          sessionBuckets={view.sessionBuckets}
          heatmap={view.heatmap}
          sample={view.heatmapSample}
          rangeTitle={title}
        />
      </Section>

      <Section
        title="Top sessions"
        testID="top-sessions-section"
        isEmpty={!sessionsLoading && !sessionsError && view.topSessions.length === 0}
        emptyLabel="No sessions were active in this range."
      >
        {sessionsError ? (
          <Notice tone="danger" message={sessionsError} actionLabel="Retry" onAction={onRetrySessions} />
        ) : (
          <SessionList
            sessions={view.topSessions}
            onPress={sessionPress}
            caption="Ranked by each session's lifetime tokens, among sessions active in this range."
            testID="top-sessions"
          />
        )}
      </Section>
    </View>
  );
};

export default AnalyticsOverview;
