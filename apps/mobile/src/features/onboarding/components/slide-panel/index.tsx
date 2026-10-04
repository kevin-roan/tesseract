import { useMemo } from "react";
import { View } from "react-native";
import type { Icon } from "phosphor-react-native";

import BarStrip from "@/components/bar-strip";
import CellMatrix from "@/components/cell-matrix";
import DataCard from "@/components/data-card";
import MetricReadout from "@/components/metric-readout";
import TagChip from "@/components/tag-chip";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import { useSlidePanelLayout } from "../../hooks/use-slide-panel-layout";
import type { OnboardingPanel } from "../../utils/content";
import createStyles from "./styles";

export type SlidePanelProps = {
  panel: OnboardingPanel;
  icon?: Icon;
  active?: boolean;
};

const SlidePanel = ({ panel, icon, active = true }: SlidePanelProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { compact, cellSize, barHeight } = useSlidePanelLayout();
  const { chart, legend } = panel;

  return (
    <DataCard
      title={panel.title}
      icon={icon}
      aside={<TagChip label={panel.chip} caret={panel.caret} />}
      axis={compact ? undefined : panel.axis}
      footer={
        legend && !compact ? (
          <View style={styles.legend}>
            <ThemedText variant="caption" color="textTertiary">
              {legend.start}
            </ThemedText>
            <CellMatrix levels={legend.levels} cellSize={theme.spacing.md} />
            <ThemedText variant="caption" color="textTertiary">
              {legend.end}
            </ThemedText>
          </View>
        ) : undefined
      }
    >
      <View style={styles.stats}>
        {panel.stats.map((stat) => (
          <MetricReadout key={stat.label} {...stat} />
        ))}
      </View>
      {chart.kind === "matrix" ? (
        <CellMatrix levels={chart.levels} live={chart.live} shape={chart.shape} cellSize={cellSize} active={active} />
      ) : (
        <BarStrip values={chart.values} emphasis={chart.emphasis} stream={chart.stream} height={barHeight} active={active} />
      )}
    </DataCard>
  );
};

export default SlidePanel;
