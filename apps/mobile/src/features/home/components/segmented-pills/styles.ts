import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: theme.spacing.xs,
    },
    pill: {
      minHeight: ControlHeight.sm,
      minWidth: ControlHeight.sm + theme.spacing.md,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.full,
    },
    pressed: {
      transform: [{ scale: 0.96 }],
    },
  });
}
