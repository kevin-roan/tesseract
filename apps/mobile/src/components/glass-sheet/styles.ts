import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme, bottomInset: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: "flex-end",
      alignItems: "center",
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: theme.colors.overlay,
    },
    sheet: {
      width: "100%",
      maxWidth: theme.maxContentWidth === Infinity ? undefined : theme.maxContentWidth,
      maxHeight: "85%",
      borderTopLeftRadius: theme.radius.sheet,
      borderTopRightRadius: theme.radius.sheet,
      borderCurve: "continuous",
      overflow: "hidden",
      backgroundColor: theme.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: 0,
      borderColor: theme.colors.border,
    },
    handle: {
      alignSelf: "center",
      width: theme.spacing["2xl"],
      height: theme.spacing.xs,
      marginTop: theme.spacing.sm,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.backgroundSelected,
    },
    header: {
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    content: {
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.base,
      paddingBottom: bottomInset + theme.spacing.base,
      gap: theme.spacing.md,
    },
  });
}
