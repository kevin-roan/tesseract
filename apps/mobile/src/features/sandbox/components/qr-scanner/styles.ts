import { StyleSheet } from "react-native";

import { BorderWidth, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    frame: {
      width: "100%",
      maxWidth: theme.maxContentWidth,
      aspectRatio: 1,
      alignSelf: "center",
      overflow: "hidden",
      borderRadius: theme.radius["2xl"],
      borderCurve: "continuous",
      backgroundColor: theme.colors.surfaceSunken,
    },
    camera: {
      flex: 1,
    },
    reticle: {
      position: "absolute",
      top: "18%",
      left: "18%",
      right: "18%",
      bottom: "18%",
      borderRadius: theme.radius.xl,
      borderWidth: BorderWidth.focus,
      borderColor: theme.colors.accent,
    },
    overlayAction: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: theme.spacing.base,
      alignItems: "center",
    },
    placeholder: {
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.base,
      padding: theme.spacing.xl,
    },
    centered: {
      textAlign: "center",
    },
  });
}
