import { StyleSheet } from "react-native";

import { BorderWidth, type Theme } from "@/theme";

export default function createStyles(theme: Theme, size: number) {
  return StyleSheet.create({
    stack: {
      flexDirection: "row",
      alignItems: "center",
    },
    /** Each avatar after the first slides back over the one before it. */
    slot: {
      marginLeft: -Math.round(size / 3),
    },
    firstSlot: {
      marginLeft: 0,
    },
    avatar: {
      width: size,
      height: size,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    /** Separates overlapping faces. */
    ring: {
      borderWidth: BorderWidth.thick,
      borderColor: theme.colors.surface,
    },
    overflowBadge: {
      backgroundColor: theme.colors.backgroundSelected,
    },
    count: {
      fontVariant: ["tabular-nums"],
    },
  });
}
