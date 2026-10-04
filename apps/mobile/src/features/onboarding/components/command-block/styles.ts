import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    block: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingLeft: theme.spacing.md,
      paddingRight: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.sm,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    line: {
      flex: 1,
    },
    copy: {
      width: ControlHeight.sm,
      height: ControlHeight.sm,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.xs,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    pressed: {
      backgroundColor: theme.colors.backgroundSelected,
    },
  });
}
