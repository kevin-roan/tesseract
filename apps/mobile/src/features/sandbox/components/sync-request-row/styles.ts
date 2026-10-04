import { StyleSheet } from "react-native";

import { DotSize, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const dot = DotSize.md;

  return StyleSheet.create({
    row: {
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.base,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    dot: {
      width: dot,
      height: dot,
      borderRadius: theme.radius.full,
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs,
    },
    conflicts: {
      gap: theme.spacing.xs,
      paddingLeft: dot + theme.spacing.md,
    },
    tree: {
      paddingVertical: theme.spacing.xxs,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: theme.colors.borderStrong,
    },
    leaf: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
    },
    branch: {
      width: theme.spacing.sm,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.borderStrong,
    },
    path: {
      flex: 1,
      minWidth: 0,
    },
  });
}
