import { useMemo } from "react";
import { View } from "react-native";
import { ChartBarIcon } from "phosphor-react-native";

import { Glass } from "@/components/glass";
import Notice from "@/components/notice";
import Skeleton from "@/components/skeleton";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { SurfaceTone } from "@/theme";

import { useUsageBarColors } from "../../hooks/use-usage-bar-colors";
import { formatCount, formatTokens, type TokenSplitPart } from "../../utils/tokens";
import { rangeLabel, usageRangeOptions, type DailyTokens, type UsageRange } from "../../utils/usage";
import CardTitle from "../card-title";
import DailyBars from "../daily-bars";
import GlassStat from "../glass-stat";
import MetricFigure from "../metric-figure";
import SegmentedPills from "../segmented-pills";
import TokenSplit from "../token-split";
import createStyles, { CHART_HEIGHT } from "./styles";

export type UsageHeroData = {
  totalTokens: number;
  split: TokenSplitPart[];
  daily: DailyTokens[];
  messages: number;
  sessions: number;
  empty: boolean;
  cachedPercent?: number | null;
};

export type UsageHeroProps = {
  range: UsageRange;
  ranges: readonly UsageRange[];
  onChangeRange: (range: UsageRange) => void;
  data: UsageHeroData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  tone?: SurfaceTone;
};

const UsageHero = ({ range, ranges, onChangeRange, data, loading, error, onRetry, tone = "lavender" }: UsageHeroProps) => {
  const theme = useAppTheme(tone);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const options = useMemo(() => usageRangeOptions(ranges), [ranges]);
  const barColors = useUsageBarColors(tone);

  return (
    <Surface tone={tone} style={styles.card}>
      <CardTitle
        icon={ChartBarIcon}
        title="Claude usage"
        trailing={<SegmentedPills options={options} value={range} onChange={onChangeRange} />}
      />

      {error ? (
        <Notice tone="danger" title="Usage is unavailable" message={error} actionLabel="Retry" onAction={onRetry} />
      ) : loading || !data ? (
        <View style={styles.skeleton} testID="usage-hero-loading">
          <Skeleton height={theme.text.metric.lineHeight ?? 0} width="55%" radius="full" />
          <Skeleton height={CHART_HEIGHT} radius="xl" />
          <Skeleton height={12} radius="full" />
        </View>
      ) : (
        <>
          <View style={styles.figure}>
            <View style={styles.figureRow}>
              <View style={styles.metric}>
                <MetricFigure
                  value={formatTokens(data.totalTokens)}
                  unit="tokens"
                  accessibilityLabel={`${formatCount(data.totalTokens)} tokens in the last ${rangeLabel(range)}`}
                />
              </View>
              {!data.empty && data.cachedPercent != null ? (
                <Glass style={styles.badge}>
                  <ThemedText variant="label" numberOfLines={1}>
                    {data.cachedPercent}% cached
                  </ThemedText>
                </Glass>
              ) : null}
            </View>
            {data.empty ? (
              <ThemedText variant="bodySmall" color="textSecondary">
                No Claude activity in the last {rangeLabel(range)}. Start a chat and it shows up here.
              </ThemedText>
            ) : null}
          </View>

          {data.empty ? null : (
            <>
              <DailyBars days={data.daily} colors={barColors} testID="usage-daily" />
              <TokenSplit parts={data.split} />
            </>
          )}

          <View style={styles.footer}>
            <GlassStat value={formatCount(data.messages)} label="Messages" />
            <GlassStat value={formatCount(data.sessions)} label="Sessions" />
          </View>
        </>
      )}
    </Surface>
  );
};

export default UsageHero;
