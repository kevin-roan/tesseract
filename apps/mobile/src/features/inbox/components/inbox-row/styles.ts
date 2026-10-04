import { StyleSheet } from "react-native";

import { ToneColors, type Tone } from "@/lib/tone";
import { DotSize, type Theme } from "@/theme";

export default function createStyles(theme: Theme, tone: Tone, emphasized: boolean) {
  const colors = ToneColors[tone];
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.base,
      padding: theme.spacing.lg,
      ...(emphasized && { borderColor: theme.colors[colors.foreground] }),
    },
    body: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    top: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    title: {
      flex: 1,
    },
    unreadDot: {
      width: DotSize.md,
      height: DotSize.md,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.notification,
    },
    meta: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    project: {
      flexShrink: 1,
    },
    time: {
      fontVariant: ["tabular-nums"],
    },
  });
}
