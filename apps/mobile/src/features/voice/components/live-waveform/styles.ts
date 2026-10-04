import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme, height: number) {
  return StyleSheet.create({
    wave: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xxs,
      height,
    },
  });
}
