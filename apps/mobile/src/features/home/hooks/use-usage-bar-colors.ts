import { useMemo } from "react";

import type { DailyBarsColors } from "@/features/home/components/daily-bars";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { SurfaceTone } from "@/theme";

export function useUsageBarColors(tone?: SurfaceTone): DailyBarsColors {
  const { chart, colors } = useAppTheme(tone);
  return useMemo(
    () => ({
      bar: chart.bar,
      focus: colors.text,
      empty: chart.barEmpty,
      emptyStroke: chart.barEmptyStroke,
      axis: colors.textTertiary,
    }),
    [chart, colors],
  );
}
