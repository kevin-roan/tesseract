import { useMemo } from "react";

import type { DailyBarsColors } from "@/features/home/components/daily-bars";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { SurfaceTone } from "@/theme";

export function useUsageBarColors(tone?: SurfaceTone): DailyBarsColors {
  const { chart, colors } = useAppTheme(tone);
  return useMemo(
    () => ({
      bar: chart.sequential[chart.sequential.length - 2],
      focus: tone && tone !== "neutral" ? colors.text : colors.brand,
      empty: colors.backgroundSelected,
      emptyStroke: chart.barEmptyStroke,
      axis: colors.textTertiary,
    }),
    [chart, colors, tone],
  );
}
