import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme, avatar: number) {
  const inset = theme.spacing.base;
  const textColumn = avatar + theme.spacing.md;

  return StyleSheet.create({
    card: {
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: inset,
    },
    framed: {
      borderRadius: theme.radius.card,
      borderCurve: "continuous",
      overflow: "hidden",
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    /** Takes the slack so the timestamp stays pinned to the right. */
    headline: {
      flex: 1,
      minWidth: 0,
    },
    /** Sits on the actor line rather than floating in the middle of the block. */
    time: {
      flexShrink: 0,
      alignSelf: "flex-start",
      lineHeight: theme.text.bodyStrong.lineHeight,
    },

    /** Figures line up under the headline, clear of the avatar column. */
    metrics: {
      flexDirection: "row",
      gap: theme.spacing.base,
      paddingLeft: textColumn,
    },
    metric: {
      flex: 1,
      minWidth: 0,
    },
    figure: {
      fontVariant: ["tabular-nums"],
    },

    list: {
      paddingVertical: theme.spacing.xxs,
    },
    /** Starts under the text column so the avatars read as one rail. */
    divider: {
      height: StyleSheet.hairlineWidth,
      marginLeft: inset + textColumn,
      backgroundColor: theme.colors.divider,
    },
  });
}
