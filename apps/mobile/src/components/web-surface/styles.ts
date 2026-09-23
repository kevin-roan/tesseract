import type { CSSProperties } from "react";
import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      overflow: "hidden",
      backgroundColor: theme.colors.surfaceSunken,
    },
    webview: {
      flex: 1,
      backgroundColor: theme.colors.surfaceSunken,
    },
    loading: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceSunken,
    },
  });
}

export function createFrameStyle(theme: Theme): CSSProperties {
  return {
    border: 0,
    width: "100%",
    height: "100%",
    display: "block",
    backgroundColor: theme.colors.surfaceSunken,
  };
}
