import { StyleSheet } from "react-native";

import { FontWeights, sansFor, type Theme } from "@/theme";

export const SwatchSize = { width: 14, height: 4 } as const;

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs + theme.spacing.xxs,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm + theme.spacing.xxs,
      borderRadius: theme.radius.sm,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderStrong,
    },
    inactive: {
      opacity: 0.55,
      borderColor: theme.colors.border,
    },
    value: {
      fontFamily: sansFor(FontWeights.semibold),
      fontWeight: FontWeights.semibold,
      fontVariant: ["tabular-nums"],
    },
  });
}
