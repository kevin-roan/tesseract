import { StyleSheet } from "react-native";

import { poppinsFor, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    panel: {
      position: "absolute",
      top: 0,
      left: 0,
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.lg,
    },
    top: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.xs,
    },
    meta: {
      ...theme.text.caption,
      flexShrink: 1,
      fontFamily: poppinsFor("500"),
      color: theme.colors.textSecondary,
    },
    usage: {
      flexShrink: 0,
      fontVariant: ["tabular-nums"],
    },
    middle: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.base,
      paddingHorizontal: theme.spacing.md,
    },
    stat: {
      flex: 1,
    },
    headline: {
      ...theme.text.metric,
      fontFamily: poppinsFor("600"),
      color: theme.colors.text,
      fontVariant: ["tabular-nums"],
    },
    caption: {
      ...theme.text.caption,
      fontFamily: poppinsFor("400"),
      color: theme.colors.textSecondary,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.md,
    },
  });
}
