import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const size = ControlHeight.lg;

  return StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.base,
    },
    /**
     * A circle, not the button's default pill: GlassButton's own
     * paddingHorizontal/paddingVertical win over a plain `padding`, so both
     * axes are zeroed here and the size comes from width/height instead.
     */
    action: {
      width: size,
      height: size,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderRadius: size / 2,
    },
  });
}
