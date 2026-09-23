import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme, columns: number) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.md,
    },
    /**
     * Basis sits short of a full share to leave room for `gap`; the grow
     * factor expands each cell back to fill the row exactly.
     */
    cell: {
      flexGrow: 1,
      flexBasis: `${100 / columns - 6}%`,
    },
  });
}
