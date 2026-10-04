import { useMemo } from "react";

import { useAppTheme } from "@/hooks/use-app-theme";

import type { ChartSeries } from "../types";
import { TOKEN_KEYS, TOKEN_LABELS } from "../utils/series";

export function useChartColors() {
  const { chart, colors, look } = useAppTheme();
  return useMemo(() => {
    const graphite = look === "graphite";
    return {
      categorical: chart.categorical,
      sequential: chart.sequential,
      heat: chart.sequential,
      single: graphite ? chart.bar : chart.categorical[0],
      empty: colors.backgroundSelected,
      grid: chart.grid,
      baseline: chart.axis,
      axis: chart.label,
    };
  }, [chart, colors, look]);
}

export type ChartColors = ReturnType<typeof useChartColors>;

export function useTokenSeries(): ChartSeries[] {
  const { categorical } = useChartColors();
  return useMemo(
    () => TOKEN_KEYS.map((key, index) => ({ key, label: TOKEN_LABELS[key], color: categorical[index] })),
    [categorical],
  );
}
