import { StyleSheet } from "react-native";

import { ControlHeight, Opacity, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 1,
      gap: theme.spacing.xs,
      height: ControlHeight.md,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElement,
    },
    text: {
      flexShrink: 1,
    },
    disabled: {
      opacity: Opacity.disabled,
    },
  });
}
