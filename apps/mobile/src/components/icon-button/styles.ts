import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme, variant: "md" | "lg") {
  const size = ControlHeight[variant];

  return StyleSheet.create({
    button: {
      width: size,
      height: size,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderRadius: theme.radius.full,
    },
  });
}
