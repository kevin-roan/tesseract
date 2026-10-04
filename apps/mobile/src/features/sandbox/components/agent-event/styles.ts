import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    system: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    rule: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.divider,
    },
    systemText: {
      flexShrink: 1,
      textAlign: "center",
    },
  });
}
