import { StyleSheet } from "react-native";

import { AvatarSize, BorderWidth, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const tile = AvatarSize.md;

  return StyleSheet.create({
    card: {
      gap: theme.spacing.md,
      padding: theme.spacing.base,
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    tile: {
      width: tile,
      height: tile,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElement,
    },
    heading: {
      flex: 1,
      minWidth: 0,
    },
    index: {
      alignSelf: "flex-start",
      fontVariant: ["tabular-nums"],
    },
    connector: {
      width: BorderWidth.thin,
      height: theme.spacing.md,
      marginLeft: theme.spacing.base + tile / 2,
      backgroundColor: theme.colors.borderStrong,
    },
  });
}
