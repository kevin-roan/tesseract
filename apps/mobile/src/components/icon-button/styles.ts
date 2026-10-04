import { StyleSheet, type ViewStyle } from "react-native";

import { ControlHeight, Opacity, type Theme } from "@/theme";

/** The graphite square control: dark fill, hairline rim, small radius. Shared by every icon-only button. */
export function squareButtonLook(theme: Theme) {
  const frame: ViewStyle = {
    borderRadius: theme.radius.sm,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.background,
  };
  const pressed: ViewStyle = { backgroundColor: theme.colors.backgroundSelected };

  return { frame, pressed };
}

export default function createStyles(theme: Theme, variant: "md" | "lg") {
  const size = ControlHeight[variant];
  const square = squareButtonLook(theme);

  return StyleSheet.create({
    button: {
      width: size,
      height: size,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderRadius: theme.radius.pill,
    },
    square: {
      width: size,
      height: size,
      alignItems: "center",
      justifyContent: "center",
      ...square.frame,
    },
    pressed: square.pressed,
    disabled: {
      opacity: Opacity.disabled,
    },
  });
}
