import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    title: {
      flexShrink: 1,
    },
    action: {
      minHeight: ControlHeight.sm,
      paddingHorizontal: theme.spacing.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.pill,
    },
    actionPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.96 }],
    },
  });
}
