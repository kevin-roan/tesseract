import { StyleSheet } from "react-native";

import { poppinsFor, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      marginHorizontal: -theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    scroller: {
      flexGrow: 0,
    },
    page: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.base,
      paddingHorizontal: theme.spacing.lg + theme.spacing.md,
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
    dots: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: theme.spacing.xs + theme.spacing.xxs,
      height: theme.spacing.sm,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.textTertiary,
    },
    dotActive: {
      width: 16,
      backgroundColor: theme.colors.text,
    },
  });
}
