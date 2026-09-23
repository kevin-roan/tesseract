import { StyleSheet } from "react-native";
import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flexShrink: 1,
      maxWidth: theme.maxContentWidth,
    },
  });
}
