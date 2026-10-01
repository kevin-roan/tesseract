import { StyleSheet } from "react-native";

import { BorderWidth, IconSize, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    tool: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
      borderWidth: BorderWidth.thin,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.codeBackground,
    },
    icon: {
      marginTop: ((theme.text.label.lineHeight ?? IconSize.sm) - IconSize.sm) / 2,
    },
    toolError: {
      borderColor: theme.colors.danger,
    },
    toolBody: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    system: {
      textAlign: "center",
    },
  });
}
