import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const size = ControlHeight.lg;
  const badge = theme.spacing.lg;

  return StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    action: {
      width: size,
      height: size,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderRadius: size / 2,
    },
    badge: {
      position: "absolute",
      top: -theme.spacing.xxs,
      right: -theme.spacing.xxs,
      minWidth: badge,
      height: badge,
      paddingHorizontal: theme.spacing.xs,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      borderWidth: 2,
      borderColor: theme.colors.background,
      backgroundColor: theme.colors.notification,
    },
    badgeText: {
      fontVariant: ["tabular-nums"],
      lineHeight: badge - 4,
    },
  });
}
