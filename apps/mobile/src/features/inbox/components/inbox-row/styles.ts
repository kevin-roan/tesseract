import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme, emphasized: boolean) {
  return StyleSheet.create({
    card: {
      gap: theme.spacing.xxs,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.base,
      ...(emphasized && { borderColor: theme.colors.borderStrong }),
    },
    top: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    project: {
      flex: 1,
    },
    time: {
      fontVariant: ["tabular-nums"],
    },
    body: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
    },
    icon: {
      marginTop: 2,
    },
    preview: {
      flex: 1,
    },
  });
}
