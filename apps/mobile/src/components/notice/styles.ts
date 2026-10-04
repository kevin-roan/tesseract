import { StyleSheet } from "react-native";

import { ToneColors, type Tone } from "@/lib/tone";
import type { Theme } from "@/theme";

export default function createStyles(theme: Theme, tone: Tone) {
  const dot = theme.spacing.xs + theme.spacing.xxs;

  return StyleSheet.create({
    notice: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.base,
      borderRadius: theme.radius.card,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    body: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    dot: {
      width: dot,
      height: dot,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors[ToneColors[tone].foreground],
    },
    title: {
      flexShrink: 1,
    },
    messageRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    message: {
      flex: 1,
    },
  });
}
