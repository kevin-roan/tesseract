import { StyleSheet } from "react-native";

import { ControlHeight, Opacity, type Theme } from "@/theme";

const KEY_SCALE = 1.5;
const DOT_SIZE = 10;

export default function createStyles(theme: Theme) {
  const key = ControlHeight.lg * KEY_SCALE;

  return StyleSheet.create({
    pad: {
      alignItems: "center",
      gap: theme.spacing.lg,
    },
    dots: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: theme.spacing.sm,
      minHeight: DOT_SIZE,
    },
    dot: {
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: DOT_SIZE / 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderStrong,
      overflow: "hidden",
    },
    dotFill: {
      flex: 1,
      borderRadius: DOT_SIZE / 2,
      backgroundColor: theme.colors.text,
    },
    dotError: {
      borderColor: theme.colors.danger,
    },
    grid: {
      gap: theme.spacing.md,
    },
    row: {
      flexDirection: "row",
      gap: theme.spacing.lg,
    },
    key: {
      width: key,
      height: key,
      borderRadius: key / 2,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    keyQuiet: {
      borderColor: "transparent",
      backgroundColor: "transparent",
    },
    keySubmit: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    keyPressed: {
      backgroundColor: theme.colors.backgroundSelected,
    },
    disabled: {
      opacity: Opacity.disabled,
    },
  });
}
