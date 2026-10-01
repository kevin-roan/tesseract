import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const button = ControlHeight.md;

  return StyleSheet.create({
    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xxs,
      padding: theme.spacing.xs,
      borderRadius: theme.radius.full,
    },
    titles: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: theme.spacing.xs,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    button: {
      width: button,
      height: button,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
    },
    selected: {
      backgroundColor: theme.colors.backgroundSelected,
    },
    pressed: {
      backgroundColor: theme.colors.backgroundElement,
    },
    disabled: {
      opacity: 0.5,
    },
  });
}
