import { StyleSheet } from "react-native";

import { poppinsFor, type Theme } from "@/theme";

import { ISLAND_CHAT_ROW_HEIGHT } from "../../utils/constants";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    panel: {
      position: "absolute",
      top: 0,
      left: 0,
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.lg,
    },
    top: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.xs,
    },
    meta: {
      ...theme.text.caption,
      flexShrink: 1,
      fontFamily: poppinsFor("500"),
      color: theme.colors.textSecondary,
    },
    usage: {
      flexShrink: 0,
      fontVariant: ["tabular-nums"],
    },
    middle: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.base,
      paddingHorizontal: theme.spacing.xs,
    },
    stat: {
      flex: 1,
    },
    headline: {
      ...theme.text.metric,
      fontFamily: poppinsFor("600"),
      color: theme.colors.text,
      fontVariant: ["tabular-nums"],
    },
    captionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    caption: {
      ...theme.text.caption,
      flexShrink: 1,
      fontFamily: poppinsFor("400"),
      color: theme.colors.textSecondary,
    },
    more: {
      ...theme.text.caption,
      fontFamily: poppinsFor("600"),
      color: theme.colors.text,
      fontVariant: ["tabular-nums"],
    },
    chats: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    chat: {
      height: ISLAND_CHAT_ROW_HEIGHT,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    chatDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.text,
    },
    chatTitle: {
      ...theme.text.caption,
      flex: 1,
      fontFamily: poppinsFor("500"),
      color: theme.colors.text,
    },
    chatMeta: {
      ...theme.text.caption,
      flexShrink: 0,
      maxWidth: "45%",
      fontFamily: poppinsFor("400"),
      color: theme.colors.textSecondary,
      fontVariant: ["tabular-nums"],
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.md,
    },
  });
}
