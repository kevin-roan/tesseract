import { useCallback } from "react";
import type { ViewStyle } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";
import { BorderWidth } from "@/theme";

/**
 * Cell style for a token-split part: the first parts step down the sequential ramp in clearly separate greys, any
 * further part is an outlined cell, and an empty cell (-1) takes the track color.
 */
export function useSplitShades(): (part: number) => ViewStyle {
  const { chart, colors } = useAppTheme();
  return useCallback(
    (part: number): ViewStyle => {
      if (part < 0) return { backgroundColor: colors.backgroundSelected };
      const fills = [chart.sequential[4], chart.sequential[3], chart.sequential[2]];
      if (part < fills.length) return { backgroundColor: fills[part] };
      return { borderWidth: BorderWidth.thin, borderColor: colors.textSecondary };
    },
    [chart, colors],
  );
}
