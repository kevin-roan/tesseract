import { StyleSheet } from "react-native";

import { ToneColors, type Tone } from "@/lib/tone";
import type { Theme } from "@/theme";

export default function createStyles(theme: Theme, tone: Tone) {
  const { foreground, background } = ToneColors[tone];
  const dot = theme.spacing.sm;
  const halo = dot + theme.spacing.xs;

  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    halo: {
      width: halo,
      height: halo,
      alignItems: "center",
      justifyContent: "center",
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
