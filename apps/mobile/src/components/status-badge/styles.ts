import { StyleSheet } from "react-native";

import { ToneColors, type Tone } from "@/lib/tone";
import type { Theme } from "@/theme";

export default function createStyles(theme: Theme, tone: Tone) {
  const { foreground, background } = ToneColors[tone];
  const dot = theme.spacing.xs + theme.spacing.xxs;

  return StyleSheet.create({
    badge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors[background],
    },
    dot: {
      width: dot,
      height: dot,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors[foreground],
    },
  });
}
