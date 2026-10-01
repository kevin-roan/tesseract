import { StyleSheet } from "react-native";

import { MinTouchTarget, Shadows, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: "flex-end",
    },
    scrim: {
      ...StyleSheet.absoluteFill,
      backgroundColor: theme.colors.overlay,
    },
    sheet: {
      gap: theme.spacing.base,
      paddingTop: theme.spacing.sm,
      paddingHorizontal: theme.gutter,
      paddingBottom: theme.spacing.base,
      borderTopLeftRadius: theme.radius.sheet,
      borderTopRightRadius: theme.radius.sheet,
      borderCurve: "continuous",
      backgroundColor: theme.colors.background,
      ...Shadows.level3,
    },
    handle: {
      alignSelf: "center",
      width: theme.spacing["2xl"],
      height: theme.spacing.xs,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.borderStrong,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    close: {
      width: MinTouchTarget,
      height: MinTouchTarget,
    },
    titles: {
      flex: 1,
      alignItems: "center",
      gap: theme.spacing.xxs,
    },
    centered: {
      textAlign: "center",
    },
  });
}
