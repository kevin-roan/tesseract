import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme, topInset: number) {
  const nav = ControlHeight.md;
  const fill = theme.surfaces.ink.fill.outer;

  return StyleSheet.create({
    /** Bleeds past the scaffold gutter and under the status bar; the bottom padding leaves room for the sheet corner. */
    hero: {
      gap: theme.spacing.base,
      marginHorizontal: -theme.gutter,
      paddingHorizontal: theme.gutter,
      paddingTop: topInset + theme.spacing.sm,
      paddingBottom: theme.radius["2xl"] + theme.spacing.base,
      backgroundColor: fill,
    },
    /** Keeps the hero fill behind the pull-to-refresh bounce. */
    overscroll: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: "100%",
      height: theme.height,
      backgroundColor: fill,
    },

    navRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    navButton: {
      width: nav,
      height: nav,
    },
    navSpacer: {
      width: nav,
      height: nav,
    },

    identity: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    avatar: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    /** Takes the slack so long names wrap instead of pushing the avatar. */
    names: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs,
    },

    teamPill: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      maxWidth: "100%",
      gap: theme.spacing.xs,
      marginTop: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.radius.sm,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElement,
    },
    teamLabel: {
      flexShrink: 1,
    },

    stats: {
      flexDirection: "row",
      paddingVertical: theme.spacing.base,
      borderRadius: theme.radius.card,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElement,
    },
    /** Equal columns, each centred on its own share of the row. */
    stat: {
      flex: 1,
      flexBasis: 0,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.xs,
    },
    statText: {
      textAlign: "center",
    },
    statValue: {
      fontVariant: ["tabular-nums"],
    },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: "stretch",
      backgroundColor: theme.colors.divider,
    },
  });
}
