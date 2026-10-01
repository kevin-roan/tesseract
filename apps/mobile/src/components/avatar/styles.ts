import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme, size: number) {
  return StyleSheet.create({
    avatar: {
      width: size,
      height: size,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      backgroundColor: theme.colors.backgroundElement,
    },
    image: {
      width: "100%",
      height: "100%",
    },
  });
}
