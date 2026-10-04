import { StyleSheet } from "react-native";

import { BorderWidth, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const arm = theme.spacing["2xl"];
  const edge = BorderWidth.thick;

  return StyleSheet.create({
    frame: {
      ...StyleSheet.absoluteFill,
      margin: theme.spacing.xl,
    },
    corner: {
      position: "absolute",
      width: arm,
      height: arm,
      borderColor: theme.colors.text,
    },
    topLeft: { top: 0, left: 0, borderTopWidth: edge, borderLeftWidth: edge },
    topRight: { top: 0, right: 0, borderTopWidth: edge, borderRightWidth: edge },
    bottomLeft: { bottom: 0, left: 0, borderBottomWidth: edge, borderLeftWidth: edge },
    bottomRight: { bottom: 0, right: 0, borderBottomWidth: edge, borderRightWidth: edge },
  });
}
