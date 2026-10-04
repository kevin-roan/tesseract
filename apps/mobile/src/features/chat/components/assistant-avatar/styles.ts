import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme, size: number) {
  return StyleSheet.create({
    avatar: {
      width: size,
      height: size,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.xs,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
    },
  });
}
