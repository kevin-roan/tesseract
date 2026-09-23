import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme, avatar: number) {
  return StyleSheet.create({
    card: {
      gap: theme.spacing.md,
      padding: theme.spacing.base,
      borderRadius: theme.radius.lg,
      borderCurve: "continuous",
      overflow: "hidden",
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    avatar: {
      width: avatar,
      height: avatar,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      backgroundColor: theme.colors.accentMuted,
    },
    avatarImage: {
      width: "100%",
      height: "100%",
    },
    /** Takes the slack so the timestamp stays pinned to the right. */
    headline: {
      flex: 1,
      gap: theme.spacing.xxs,
    },

    /** Figures line up under the headline, clear of the avatar column. */
    metrics: {
      flexDirection: "row",
      paddingLeft: avatar + theme.spacing.md,
    },
    metric: {
      flex: 1,
      gap: theme.spacing.xxs,
    },

    pressed: {
      opacity: 0.85,
    },
  });
}
