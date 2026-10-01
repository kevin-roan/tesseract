import { StyleSheet } from "react-native";

import { IconSize, type Theme } from "@/theme";

export const HERO_ORB_ICON_SIZE = IconSize["2xl"];

export default function createStyles(theme: Theme) {
  const core = IconSize["2xl"] * 2.25;

  return StyleSheet.create({
    container: {
      width: core * 2,
      height: core * 2,
      alignItems: "center",
      justifyContent: "center",
    },
    ring: {
      position: "absolute",
      borderRadius: theme.radius.full,
    },
    outer: {
      width: core * 2,
      height: core * 2,
      backgroundColor: theme.colors.accentMuted,
    },
    inner: {
      width: core * 1.5,
      height: core * 1.5,
      backgroundColor: theme.colors.accentMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.accent,
    },
    core: {
      width: core,
      height: core,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.accent,
    },
  });
}
