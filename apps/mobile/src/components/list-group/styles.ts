import { StyleSheet } from "react-native";

import { ControlHeight, IconSize, type Theme } from "@/theme";

export type ListDividerInset = "icon" | "text" | "none";

export default function createStyles(theme: Theme) {
  const rowPadding = theme.spacing.base;
  const dividerInsets: Record<ListDividerInset, number> = {
    icon: rowPadding + IconSize.lg + theme.spacing.md,
    text: rowPadding,
    none: 0,
  };

  return {
    dividerInsets,
    ...StyleSheet.create({
      group: {
        gap: theme.spacing.sm,
      },
      title: {
        paddingHorizontal: rowPadding,
      },
      card: {
        borderRadius: theme.radius.xl,
        borderCurve: "continuous",
        overflow: "hidden",
        backgroundColor: theme.colors.surface,
      },
      divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
      },
      footnote: {
        paddingHorizontal: rowPadding,
      },
      row: {
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        minHeight: ControlHeight.xl,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: rowPadding,
      },
      rowPressed: {
        backgroundColor: theme.colors.backgroundSelected,
      },
      rowDisabled: {
        opacity: 0.5,
      },
      body: {
        flex: 1,
        minWidth: 0,
      },
      value: {
        flexShrink: 1,
        maxWidth: "50%",
        textAlign: "right",
      },
      badge: {
        minWidth: IconSize.md,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xxs,
        borderRadius: theme.radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.colors.badge,
      },
    }),
  };
}
