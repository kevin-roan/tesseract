import { StyleSheet } from "react-native";

import { ToneColors, type Tone } from "@/lib/tone";
import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme, tone: Tone) {
  return StyleSheet.create({
    notice: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radius.card,
      borderCurve: "continuous",
      backgroundColor: theme.colors[ToneColors[tone].background],
    },
    iconBadge: {
      width: ControlHeight.md,
      height: ControlHeight.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.surfaceElevated,
    },
    body: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    action: {
      minHeight: ControlHeight.sm,
      justifyContent: "center",
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.surfaceElevated,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
