import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    badge: {
      width: ControlHeight.md,
      height: ControlHeight.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
    },
    title: {
      flex: 1,
    },
  });
}
