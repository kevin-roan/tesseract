import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

import { INLINE_HEIGHT_RATIO } from "./lines";

export default function createStyles(theme: Theme) {
  const jump = ControlHeight.md;

  return StyleSheet.create({
    container: {
      flex: 1,
      overflow: "hidden",
      borderRadius: theme.radius.card,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.codeBackground,
    },
    inline: {
      flex: 0,
      height: Math.round(theme.height * INLINE_HEIGHT_RATIO),
    },
    content: {
      padding: theme.spacing.md,
      paddingRight: theme.spacing.sm * 2 + ControlHeight.sm,
      gap: theme.spacing.xxs,
    },
    copy: {
      position: "absolute",
      top: theme.spacing.sm,
      right: theme.spacing.sm,
      width: ControlHeight.sm,
      height: ControlHeight.sm,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.xs,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.codeBackground,
    },
    jumpSlot: {
      position: "absolute",
      right: theme.spacing.md,
      bottom: theme.spacing.md,
    },
    jump: {
      width: jump,
      height: jump,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.pill,
      borderCurve: "continuous",
      backgroundColor: theme.colors.accent,
    },
  });
}
