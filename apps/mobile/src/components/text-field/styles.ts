import { StyleSheet } from "react-native";

import { BorderWidth, ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme, multiline: boolean) {
  const graphite = theme.look === "graphite";
  const text = theme.text.body;

  return StyleSheet.create({
    field: {
      gap: theme.spacing.xs,
    },
    label: {
      ...theme.text.label,
      color: theme.colors.textSecondary,
    },
    box: {
      flexDirection: "row",
      alignItems: multiline ? "flex-start" : "center",
      gap: theme.spacing.sm,
      minHeight: multiline ? ControlHeight.xl * 2 : graphite ? ControlHeight.xl : ControlHeight.lg,
      paddingHorizontal: graphite ? theme.spacing.base : theme.spacing.md,
      paddingVertical: multiline ? theme.spacing.sm : 0,
      borderRadius: graphite ? theme.radius.pill : theme.radius.md,
      borderCurve: "continuous",
      borderWidth: BorderWidth.thin,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
    },
    input: {
      flex: 1,
      ...text,
      lineHeight: multiline ? text.lineHeight : undefined,
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
