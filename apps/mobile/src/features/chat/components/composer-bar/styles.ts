import { StyleSheet } from "react-native";

import { ControlHeight, Shadows, type Theme } from "@/theme";

export default function createStyles(theme: Theme, maxLines: number) {
  const lineHeight = theme.text.body.lineHeight ?? ControlHeight.sm;

  return StyleSheet.create({
    card: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius["2xl"],
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      ...Shadows.level1,
    },
    input: {
      minHeight: lineHeight * 2,
      maxHeight: lineHeight * maxLines,
      paddingHorizontal: theme.spacing.xs,
      paddingTop: theme.spacing.xs,
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
    round: {
      width: ControlHeight.md,
      height: ControlHeight.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
    },
    outlined: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderStrong,
    },
    primary: {
      backgroundColor: theme.colors.accent,
    },
    pressed: {
      opacity: 0.7,
    },
    disabled: {
      opacity: 0.45,
    },
  });
}
