import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  // Two up on a phone, whatever the breakpoint allows above that.
  const columns = Math.max(2, theme.gridColumns);

  return StyleSheet.create({
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.md,
    },
    /**
     * The basis is deliberately short of a full share so `gap` has room; the
     * grow factor then expands each cell back to fill the row exactly.
     */
    cell: {
      flexGrow: 1,
      flexBasis: `${100 / columns - 6}%`,
    },
  });
}
