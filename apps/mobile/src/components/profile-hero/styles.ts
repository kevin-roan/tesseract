import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme, avatar: number) {
  const nav = ControlHeight.lg;

  return StyleSheet.create({
    hero: {
      gap: theme.spacing.base,
    },

    navRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    /**
     * A circle, not the button's default pill: GlassButton's own
     * paddingHorizontal/paddingVertical win over a plain `padding`, so both
     * axes are zeroed here and the size comes from width/height instead.
     */
    navButton: {
      width: nav,
      height: nav,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderRadius: nav / 2,
    },
    /** Keeps a lone menu button on the right when there is no back button. */
    navSpacer: {
      width: nav,
    },

    card: {
      gap: theme.spacing.base,
      padding: theme.spacing.lg,
      borderRadius: theme.radius["2xl"],
      borderCurve: "continuous",
      overflow: "hidden",
    },

    identity: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.base,
    },
    avatar: {
      width: avatar,
      height: avatar,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      backgroundColor: theme.colors.accentMuted,
    },
    avatarImage: {
      width: "100%",
      height: "100%",
    },
    /** Takes the slack so long names wrap instead of pushing the avatar. */
    names: {
      flex: 1,
      gap: theme.spacing.xxs,
    },

    teamPill: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: theme.spacing.xs,
      borderRadius: theme.radius.full,
      borderCurve: "continuous",
      overflow: "hidden",
    },

    statsRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    stat: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: "stretch",
      marginHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.border,
    },
  });
}
