import { StyleSheet } from "react-native";

import { BorderWidth, type Theme } from "@/theme";

import type { Corner } from "../../types";
import { CROP_HANDLE_SIZE } from "../../utils/constants";

const HANDLE_OFFSET = -CROP_HANDLE_SIZE / 2;
const ARM_INSET = CROP_HANDLE_SIZE / 2 - BorderWidth.thick;

export const ARMS = {
  topLeft: "topLeftArm",
  topRight: "topRightArm",
  bottomLeft: "bottomLeftArm",
  bottomRight: "bottomRightArm",
} as const satisfies Record<Corner, string>;

export default function createStyles(theme: Theme) {
  const edge = BorderWidth.thick;

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
      borderRadius: theme.radius.card,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
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
      borderWidth: BorderWidth.thin,
      borderColor: theme.colors.borderStrong,
    },
    handle: {
      position: "absolute",
      width: CROP_HANDLE_SIZE,
      height: CROP_HANDLE_SIZE,
    },
    bracket: {
      position: "absolute",
      width: CROP_HANDLE_SIZE - ARM_INSET,
      height: CROP_HANDLE_SIZE - ARM_INSET,
      borderColor: theme.colors.text,
    },
    topLeft: { top: HANDLE_OFFSET, left: HANDLE_OFFSET },
    topRight: { top: HANDLE_OFFSET, right: HANDLE_OFFSET },
    bottomLeft: { bottom: HANDLE_OFFSET, left: HANDLE_OFFSET },
    bottomRight: { bottom: HANDLE_OFFSET, right: HANDLE_OFFSET },
    topLeftArm: { top: ARM_INSET, left: ARM_INSET, borderTopWidth: edge, borderLeftWidth: edge },
    topRightArm: { top: ARM_INSET, right: ARM_INSET, borderTopWidth: edge, borderRightWidth: edge },
    bottomLeftArm: { bottom: ARM_INSET, left: ARM_INSET, borderBottomWidth: edge, borderLeftWidth: edge },
    bottomRightArm: { bottom: ARM_INSET, right: ARM_INSET, borderBottomWidth: edge, borderRightWidth: edge },
    actions: {
      flexDirection: "row",
      gap: theme.spacing.md,
    },
    action: {
      flex: 1,
    },
  });
}
