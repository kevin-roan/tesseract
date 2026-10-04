import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

import { ISLAND_ORB_CANVAS_PAD, ISLAND_ORB_SIZE } from "../../utils/constants";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    orb: {
      position: "absolute",
      top: 0,
      left: 0,
      width: ISLAND_ORB_SIZE,
      height: ISLAND_ORB_SIZE,
    },
    root: {
      width: ISLAND_ORB_SIZE,
      height: ISLAND_ORB_SIZE,
      overflow: "visible",
    },
    body: {
      width: ISLAND_ORB_SIZE,
      height: ISLAND_ORB_SIZE,
      overflow: "visible",
    },
    canvas: {
      position: "absolute",
      top: -ISLAND_ORB_CANVAS_PAD,
      left: -ISLAND_ORB_CANVAS_PAD,
      width: ISLAND_ORB_SIZE + ISLAND_ORB_CANVAS_PAD * 2,
      height: ISLAND_ORB_SIZE + ISLAND_ORB_CANVAS_PAD * 2,
    },
    press: {
      width: ISLAND_ORB_SIZE,
      height: ISLAND_ORB_SIZE,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
    },
    count: {
      color: theme.colors.text,
      fontVariant: ["tabular-nums"],
    },
  });
}
