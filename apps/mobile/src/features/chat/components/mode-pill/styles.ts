import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 1,
      gap: theme.spacing.xs,
      height: ControlHeight.md,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderStrong,
    },
    text: {
      flexShrink: 1,
    },
    pressed: {
      backgroundColor: theme.colors.backgroundElement,
    },
    disabled: {
      opacity: 0.45,
    },
  });
}
