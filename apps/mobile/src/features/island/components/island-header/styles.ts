import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    copy: {
      flex: 1,
      alignItems: "flex-start",
      gap: theme.spacing.xs,
    },
    name: {
      alignSelf: "stretch",
    },
    collapse: {
      width: ControlHeight.sm,
      height: ControlHeight.sm,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElement,
    },
  });
}
