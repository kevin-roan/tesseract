import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export type TagChipSize = "sm" | "md";

export default function createStyles(theme: Theme, size: TagChipSize, pressable: boolean) {
  const roomy = size === "md";
  const dot = theme.spacing.xs + theme.spacing.xxs;

  return StyleSheet.create({
    chip: {
      maxWidth: "100%",
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      minHeight: roomy || pressable ? ControlHeight.sm : undefined,
      paddingHorizontal: roomy ? theme.spacing.md : theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.radius.sm,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElement,
    },
    label: {
      flexShrink: 1,
      fontVariant: ["tabular-nums"],
    },
    pressable: {
      borderColor: theme.colors.borderStrong,
    },
    dot: {
      width: dot,
      height: dot,
      borderRadius: theme.radius.full,
    },
  });
}
