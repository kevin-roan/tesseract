import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

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
      backgroundColor: theme.colors.accentMuted,
      borderWidth: 2,
      borderColor: theme.colors.surfaceElevated,
    },
    image: {
      width: "100%",
      height: "100%",
    },
    overflowBadge: {
      backgroundColor: theme.colors.backgroundSelected,
    },
  });
}
