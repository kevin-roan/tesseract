import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.xs,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      minHeight: ControlHeight.md,
    },
    cancel: {
      width: ControlHeight.md,
      height: ControlHeight.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.dangerMuted,
    },
    pressed: {
      opacity: 0.7,
    },
    disabled: {
      opacity: 0.4,
    },
    dot: {
      width: theme.spacing.sm,
      height: theme.spacing.sm,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.dangerSolid,
    },
    elapsed: {
      fontVariant: ["tabular-nums"],
    },
    action: {
      width: ControlHeight.md,
      height: ControlHeight.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.accent,
    },
    actionPressed: {
      backgroundColor: theme.colors.accentPressed,
    },
    status: {
      paddingHorizontal: theme.spacing.xs,
      paddingBottom: theme.spacing.xs,
    },
  });
}
