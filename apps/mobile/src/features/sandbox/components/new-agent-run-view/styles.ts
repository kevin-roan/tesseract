import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
    },
    headerButton: {
      width: ControlHeight.md,
      height: ControlHeight.md,
    },
    footer: {
      gap: theme.spacing.md,
    },
  });
}
