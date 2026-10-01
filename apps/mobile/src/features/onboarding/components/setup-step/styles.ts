import { StyleSheet } from "react-native";

import { AvatarSize, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const badge = AvatarSize.lg;

  return StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: theme.spacing.base,
    },
    rail: {
      alignItems: "center",
      width: badge,
    },
    badge: {
      width: badge,
      height: badge,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.accent,
    },
    line: {
      flex: 1,
      width: StyleSheet.hairlineWidth * 2,
      marginVertical: theme.spacing.xs,
      backgroundColor: theme.colors.borderStrong,
    },
    body: {
      flex: 1,
      gap: theme.spacing.xs,
      paddingBottom: theme.spacing.xl,
    },
    command: {
      alignSelf: "flex-start",
      marginTop: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.sm,
      borderCurve: "continuous",
      backgroundColor: theme.colors.codeBackground,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
  });
}
