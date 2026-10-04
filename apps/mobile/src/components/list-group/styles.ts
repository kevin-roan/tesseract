import { StyleSheet } from "react-native";

import { ControlHeight, IconSize, Opacity, type Theme } from "@/theme";

export type ListDividerInset = "icon" | "text" | "none";

export const rowIconTileSize = ControlHeight.sm;

export default function createStyles(theme: Theme) {
  const graphite = theme.look === "graphite";
  const rowPadding = theme.spacing.base;
  const dividerInsets: Record<ListDividerInset, number> = {
    icon: rowPadding + (graphite ? rowIconTileSize : IconSize.lg) + theme.spacing.md,
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
        borderRadius: theme.radius.card,
        borderCurve: "continuous",
        overflow: "hidden",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
      },
      divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.divider,
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
        ...StyleSheet.absoluteFill,
        backgroundColor: theme.colors.backgroundSelected,
      },
      rowDisabled: {
        opacity: Opacity.disabled,
      },
      body: {
        flex: 1,
        minWidth: 0,
      },
      value: {
        flexShrink: 1,
        maxWidth: "50%",
        textAlign: "right",
        fontVariant: ["tabular-nums"],
      },
      badge: {
        minWidth: IconSize.md,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xxs,
        borderRadius: graphite ? theme.radius.sm : theme.radius.pill,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.colors.badge,
      },
      check: {
        width: IconSize.lg,
        height: IconSize.lg,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: theme.radius.sm,
        borderCurve: "continuous",
        backgroundColor: theme.colors.accent,
      },
    }),
  };
}
