import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme, size: number) {
  return StyleSheet.create({
    avatar: {
      width: size,
      height: size,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      overflow: "hidden",
    },
  });
}
