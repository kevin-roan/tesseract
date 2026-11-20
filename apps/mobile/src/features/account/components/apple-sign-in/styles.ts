import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

import { APPLE_BUTTON_HEIGHT } from "../../utils/apple";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.lg,
    },
    button: {
      alignSelf: "stretch",
      height: APPLE_BUTTON_HEIGHT,
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    rule: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
    },
  });
}
