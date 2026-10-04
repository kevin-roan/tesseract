import { StyleSheet } from "react-native";

import { BorderWidth, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    viewport: {
      width: "100%",
      maxWidth: theme.maxContentWidth,
      aspectRatio: 1,
      alignSelf: "center",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
      borderWidth: BorderWidth.thin,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceSunken,
    },
    camera: {
      ...StyleSheet.absoluteFill,
    },
    prompt: {
      gap: theme.spacing.md,
    },
    footerText: {
      flexShrink: 1,
    },
  });
}
