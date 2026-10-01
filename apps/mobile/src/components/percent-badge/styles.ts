import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    badge: {
      minHeight: ControlHeight.sm,
      paddingHorizontal: theme.spacing.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.pill,
    },
    label: {
      fontVariant: ["tabular-nums"],
    },
  });
}
