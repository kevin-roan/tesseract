import { StyleSheet } from "react-native";

import { ControlHeight, Opacity, type Theme } from "@/theme";

export default function createStyles(theme: Theme, maxLines: number) {
  const lineHeight = theme.text.body.lineHeight ?? ControlHeight.sm;

  return StyleSheet.create({
    card: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.sheet,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    input: {
      minHeight: lineHeight * 2,
      maxHeight: lineHeight * maxLines,
      paddingHorizontal: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      paddingBottom: 0,
      color: theme.colors.text,
      ...theme.text.body,
      textAlignVertical: "top",
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    tools: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      overflow: "hidden",
    },
    button: {
      width: ControlHeight.md,
      height: ControlHeight.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
    },
    outlined: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElement,
    },
    primary: {
      backgroundColor: theme.colors.accent,
    },
    disabled: {
      opacity: Opacity.disabled,
    },
  });
}
