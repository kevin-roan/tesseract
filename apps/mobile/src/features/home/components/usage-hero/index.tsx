import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { ChartBarIcon } from "phosphor-react-native";

import Notice from "@/components/notice";
import Skeleton from "@/components/skeleton";
import { Surface } from "@/components/surface";
import TagChip from "@/components/tag-chip";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";
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

const UsageHero = ({ range, ranges, onChangeRange, data, loading, error, onRetry, tone = "neutral" }: UsageHeroProps) => {
  const theme = useAppTheme(tone);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const options = useMemo(() => usageRangeOptions(ranges), [ranges]);
  const barColors = useUsageBarColors(tone);
  const figureEntering = useEntrance(0);
  const chartEntering = useEntrance(1);
  const splitEntering = useEntrance(2);
  const footerEntering = useEntrance(3);

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
          <Skeleton height={theme.text.metric.lineHeight ?? 0} width="55%" radius="xs" />
          <Skeleton height={CHART_HEIGHT} radius="sm" />
          <Skeleton height={theme.spacing.md} radius="none" />
        </View>
      ) : (
        <>
          <Animated.View entering={figureEntering} style={styles.figure}>
            <View style={styles.figureRow}>
              <View style={styles.metric}>
                <MetricFigure
                  value={formatTokens(data.totalTokens)}
                  unit="tokens"
                  accessibilityLabel={`${formatCount(data.totalTokens)} tokens in the last ${rangeLabel(range)}`}
                />
              </View>
              {!data.empty && data.cachedPercent != null ? (
                <TagChip label={`${data.cachedPercent}% cached`} />
              ) : null}
            </View>
            {data.empty ? (
              <ThemedText variant="bodySmall" color="textSecondary">
                No Claude activity in the last {rangeLabel(range)}. Start a chat and it shows up here.
              </ThemedText>
            ) : null}
          </Animated.View>

          {data.empty ? null : (
            <>
              <Animated.View entering={chartEntering}>
                <DailyBars days={data.daily} colors={barColors} testID="usage-daily" />
              </Animated.View>
              <Animated.View entering={splitEntering}>
                <TokenSplit parts={data.split} />
              </Animated.View>
            </>
          )}

          <Animated.View entering={footerEntering} style={styles.footer}>
            <GlassStat value={formatCount(data.messages)} label="Messages" />
            <GlassStat value={formatCount(data.sessions)} label="Sessions" />
          </Animated.View>
        </>
      )}
    </Surface>
  );
};

export default UsageHero;
