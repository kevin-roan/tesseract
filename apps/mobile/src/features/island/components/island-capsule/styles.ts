import { StyleSheet } from "react-native";

import { poppinsFor, type Theme } from "@/theme";

import { ISLAND_CAPSULE_HEIGHT, ISLAND_CAPSULE_WIDTH } from "../../utils/constants";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    capsule: {
      position: "absolute",
      top: 0,
      left: 0,
      width: ISLAND_CAPSULE_WIDTH,
      height: ISLAND_CAPSULE_HEIGHT,
    },
    fill: {
      flex: 1,
    },
    press: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.full,
    },
    value: {
      ...theme.text.label,
      flexShrink: 1,
      fontFamily: poppinsFor("600"),
      color: theme.colors.text,
      fontVariant: ["tabular-nums"],
    },
  });
}
