import { StyleSheet } from "react-native";

import { ToneColors, type Tone } from "@/lib/tone";
import { BorderWidth, ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme, tone: Tone, emphasized: boolean) {
  const colors = ToneColors[tone];
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
      padding: theme.spacing.base,
      borderRadius: theme.radius.lg,
      borderCurve: "continuous",
      overflow: "hidden",
      borderWidth: emphasized ? BorderWidth.thin : 0,
      borderColor: theme.colors[colors.foreground],
    },
    badge: {
      width: ControlHeight.md,
      height: ControlHeight.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
      backgroundColor: theme.colors[colors.background],
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
      width: theme.spacing.sm,
      height: theme.spacing.sm,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.notification,
    },
    meta: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    pressed: {
      opacity: 0.85,
    },
  });
}
