import { StyleSheet } from "react-native";

import { ControlHeight, poppinsFor, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    round: {
      width: ControlHeight.lg,
      height: ControlHeight.lg,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.backgroundElement,
    },
    roundPressed: {
      backgroundColor: theme.colors.backgroundSelected,
    },
    primary: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      flex: 1,
      height: ControlHeight.lg,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.accent,
    },
    primaryPressed: {
      backgroundColor: theme.colors.accentPressed,
    },
    label: {
      ...theme.text.label,
      flexShrink: 1,
      fontFamily: poppinsFor("600"),
      color: theme.colors.accentInk,
    },
    badge: {
      position: "absolute",
      top: -theme.spacing.xxs,
      right: -theme.spacing.xxs,
      minWidth: theme.spacing.lg,
      height: theme.spacing.lg,
      paddingHorizontal: theme.spacing.xs,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.text,
    },
    badgeText: {
      ...theme.text.caption,
      fontFamily: poppinsFor("600"),
      color: theme.colors.textInverse,
      fontVariant: ["tabular-nums"],
    },
  });
}
