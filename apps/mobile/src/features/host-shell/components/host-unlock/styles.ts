import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const badge = ControlHeight.xl * 1.4;

  return StyleSheet.create({
    screen: {
      flex: 1,
      gap: theme.spacing.base,
      paddingHorizontal: theme.gutter,
      paddingBottom: theme.spacing.lg,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.lg,
    },
    badge: {
      width: badge,
      height: badge,
      borderRadius: badge / 2,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    badgeError: {
      borderColor: theme.colors.danger,
    },
    heading: {
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    status: {
      alignItems: "center",
      gap: theme.spacing.xs,
      minHeight: ControlHeight.sm,
    },
  });
}
