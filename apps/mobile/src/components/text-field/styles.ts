import { StyleSheet } from "react-native";

import { BorderWidth, ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme, multiline: boolean) {
  return StyleSheet.create({
    field: {
      gap: theme.spacing.xs,
    },
    box: {
      flexDirection: "row",
      alignItems: multiline ? "flex-start" : "center",
      gap: theme.spacing.sm,
      minHeight: multiline ? ControlHeight.xl * 2 : ControlHeight.lg,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: multiline ? theme.spacing.sm : 0,
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
      borderWidth: BorderWidth.thin,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
    },
    boxFocused: {
      borderColor: theme.colors.focusRing,
    },
    boxError: {
      borderColor: theme.colors.danger,
    },
    input: {
      flex: 1,
      ...theme.text.body,
      lineHeight: multiline ? theme.text.body.lineHeight : undefined,
      textAlignVertical: multiline ? "top" : "center",
      color: theme.colors.text,
      paddingHorizontal: 0,
      paddingVertical: theme.spacing.sm,
    },
    mono: {
      ...theme.text.code,
      lineHeight: multiline ? theme.text.code.lineHeight : undefined,
      color: theme.colors.text,
    },
  });
}
