import { StyleSheet } from "react-native";

import { AvatarSize, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    preview: {
      gap: theme.spacing.sm,
      padding: theme.spacing.base,
      borderRadius: theme.radius.card,
    },
    thumbs: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    thumb: {
      width: AvatarSize.xl,
      height: AvatarSize.xl,
      borderRadius: theme.radius.pill,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElement,
    },
    count: {
      fontVariant: ["tabular-nums"],
    },
  });
}
