import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme, height: number = ControlHeight.sm) {
  return StyleSheet.create({
    wave: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xxs,
      height,
    },
    column: {
      flex: 1,
      justifyContent: "center",
      gap: theme.spacing.xxs,
      height,
    },
    dash: {
      height: theme.spacing.xxs,
      borderRadius: theme.radius.full,
    },
  });
}
