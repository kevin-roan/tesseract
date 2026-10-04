import { StyleSheet } from "react-native";

import { ControlHeight, FontWeights, IconSize, sansFor, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      minHeight: ControlHeight.lg,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
    },
    rowLarge: {
      minHeight: ControlHeight.xl,
    },
    label: {
      flex: 1,
    },
    badge: {
      minWidth: IconSize.lg,
      height: IconSize.lg,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.xs,
      borderRadius: theme.radius.sm,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundSelected,
    },
    badgeText: {
      fontFamily: sansFor(FontWeights.medium),
      fontWeight: FontWeights.medium,
      fontVariant: ["tabular-nums"],
    },
  });
}
