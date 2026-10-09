import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme, tabBarInset: number, hasFooter: boolean) {
  const bodyInset = hasFooter ? 0 : tabBarInset;
  // The tab bar inset already leaves `base` of breathing room for scrolling content; a footer docks closer.
  const footerInset = tabBarInset > 0 ? tabBarInset - theme.spacing.base + theme.spacing.sm : theme.spacing.md;

  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    fill: {
      flex: 1,
    },
    header: {
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
    },
    content: {
      flexGrow: 1,
      gap: theme.sectionGap,
      paddingHorizontal: theme.gutter,
      paddingBottom: theme.sectionGap + bodyInset,
    },
    body: {
      paddingBottom: bodyInset,
    },
    footer: {
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.md,
      paddingBottom: footerInset,
    },
  });
}
