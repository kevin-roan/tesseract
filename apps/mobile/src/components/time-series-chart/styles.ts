import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

import type { ChartFrame } from "./geometry";

const AxisGutter = 40;
const LabelBand = 22;
const DotRadius = 3.5;

export const plotHeight = (theme: Theme) => (theme.isTablet ? 220 : 168);
export const endDotRadius = DotRadius;

export function chartFrame(theme: Theme, width: number): ChartFrame {
  const inset = theme.spacing.sm;
  return {
    left: AxisGutter,
    top: inset,
    width: Math.max(0, width - AxisGutter - DotRadius * 2),
    height: plotHeight(theme),
  };
}

export const chartHeight = (theme: Theme) => theme.spacing.sm + plotHeight(theme) + LabelBand;

export default function createStyles(theme: Theme) {
  const label = { position: "absolute" as const, fontVariant: ["tabular-nums" as const] };

  return StyleSheet.create({
    chart: {
      height: chartHeight(theme),
    },
    yLabel: {
      ...label,
      left: 0,
      width: AxisGutter - theme.spacing.sm,
      textAlign: "right",
    },
    xLabel: {
      ...label,
      width: AxisGutter * 2,
      marginLeft: -AxisGutter,
      textAlign: "center",
    },
    endLabel: {
      ...label,
      right: 0,
      textAlign: "right",
    },
    thresholdLabel: {
      ...label,
      right: DotRadius * 2,
      textAlign: "right",
    },
    empty: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
