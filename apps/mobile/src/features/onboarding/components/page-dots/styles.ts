import { StyleSheet } from "react-native";

import { BorderWidth, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    counter: {
      fontVariant: ["tabular-nums"],
    },
    track: {
      flex: 1,
      flexDirection: "row",
      gap: theme.spacing.xs,
    },
    segment: {
      flex: 1,
      height: BorderWidth.thick,
      overflow: "hidden",
      backgroundColor: theme.colors.backgroundSelected,
    },
    fill: {
      ...StyleSheet.absoluteFill,
      transformOrigin: "left",
      backgroundColor: theme.colors.text,
    },
  });
}
