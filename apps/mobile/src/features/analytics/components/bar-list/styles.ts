import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export const BAR_THICKNESS = 8;

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
    },
    top: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    titles: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    value: {
      fontVariant: ["tabular-nums"],
    },
    track: {
      height: BAR_THICKNESS,
      flexDirection: "row",
    },
    bar: {
      height: BAR_THICKNESS,
      borderTopRightRadius: theme.radius.xs,
      borderBottomRightRadius: theme.radius.xs,
    },
    pressed: {
      opacity: 0.6,
    },
  });
}
