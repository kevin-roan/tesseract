import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

import type { CellShape } from "./utils/cells";

export default function createStyles(theme: Theme, shape: CellShape, cellSize?: number) {
  const gap = shape === "dot" ? theme.spacing.xs : theme.spacing.xxs;

  return StyleSheet.create({
    matrix: {
      gap,
    },
    row: {
      flexDirection: "row",
      gap,
    },
    cell: {
      ...(cellSize === undefined ? { flex: 1, aspectRatio: 1 } : { width: cellSize, height: cellSize }),
      borderRadius: shape === "dot" ? theme.radius.full : theme.radius.none,
    },
    live: {
      backgroundColor: theme.chart.bar,
    },
  });
}
