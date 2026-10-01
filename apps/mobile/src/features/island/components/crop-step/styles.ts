import { StyleSheet } from "react-native";

import { BorderWidth, type Theme } from "@/theme";

import { CROP_HANDLE_SIZE } from "../../utils/constants";

const HANDLE_OFFSET = -CROP_HANDLE_SIZE / 2;

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    step: {
      flex: 1,
      gap: theme.spacing.md,
    },
    hint: {
      textAlign: "center",
    },
    canvas: {
      flex: 1,
      overflow: "hidden",
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.surfaceSunken,
    },
    image: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    dim: {
      position: "absolute",
      backgroundColor: theme.colors.overlay,
    },
    box: {
      position: "absolute",
      borderWidth: BorderWidth.thick,
      borderColor: theme.colors.accentStrong,
    },
    handle: {
      position: "absolute",
      width: CROP_HANDLE_SIZE,
      height: CROP_HANDLE_SIZE,
      borderRadius: theme.radius.full,
      borderWidth: BorderWidth.thick,
      borderColor: theme.colors.accentStrong,
      backgroundColor: theme.colors.surface,
    },
    topLeft: { top: HANDLE_OFFSET, left: HANDLE_OFFSET },
    topRight: { top: HANDLE_OFFSET, right: HANDLE_OFFSET },
    bottomLeft: { bottom: HANDLE_OFFSET, left: HANDLE_OFFSET },
    bottomRight: { bottom: HANDLE_OFFSET, right: HANDLE_OFFSET },
    actions: {
      flexDirection: "row",
      gap: theme.spacing.md,
    },
    action: {
      flex: 1,
    },
  });
}
