import { StyleSheet } from "react-native";

import { ToneColors, type Tone } from "@/lib/tone";
import type { Theme } from "@/theme";

export default function createStyles(theme: Theme, tone: Tone) {
  const height = theme.spacing.xs + theme.spacing.xxs;

  return StyleSheet.create({
    track: {
      height,
      overflow: "hidden",
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.backgroundSelected,
    },
    fill: {
      height,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors[ToneColors[tone].foreground],
    },
  });
}
