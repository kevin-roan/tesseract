import { StyleSheet } from "react-native";

import { ControlHeight, DotSize, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    capsule: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      paddingLeft: theme.spacing.sm,
      paddingRight: theme.spacing.base,
      borderRadius: theme.radius.card,
    },
    tile: {
      width: ControlHeight.sm,
      height: ControlHeight.sm,
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElement,
    },
    dot: {
      width: DotSize.md,
      height: DotSize.md,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.textTertiary,
    },
    dotLive: {
      backgroundColor: theme.colors.success,
    },
    title: {
      flex: 1,
    },
    pressed: {
      backgroundColor: theme.colors.backgroundElement,
    },
  });
}
