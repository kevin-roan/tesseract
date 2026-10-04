import { StyleSheet } from "react-native";

import { ControlHeight, DotSize, Opacity, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.xs,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      minHeight: ControlHeight.md,
    },
    cancel: {
      width: ControlHeight.md,
      height: ControlHeight.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElement,
    },
    disabled: {
      opacity: Opacity.disabled,
    },
    dot: {
      width: DotSize.md,
      height: DotSize.md,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.dangerSolid,
    },
    elapsed: {
      fontVariant: ["tabular-nums"],
    },
    action: {
      width: ControlHeight.md,
      height: ControlHeight.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
      backgroundColor: theme.colors.accent,
    },
    status: {
      paddingHorizontal: theme.spacing.xs,
      paddingBottom: theme.spacing.xs,
      textAlign: "center",
    },
  });
}
