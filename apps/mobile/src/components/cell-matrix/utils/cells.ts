import { ChartMotion, type Theme } from "@/theme";

export type CellShape = "square" | "dot";

export function cellColor(theme: Theme, level: number) {
  if (level <= 0) return theme.colors.backgroundSelected;
  const ramp = theme.chart.sequential;
  return ramp[Math.min(level + 1, ramp.length - 1)];
}

export function livePulse(phase: number) {
  "worklet";
  const wave = 0.5 + 0.5 * Math.cos(phase * Math.PI * 2);
  return ChartMotion.pulseFloor + (1 - ChartMotion.pulseFloor) * wave;
}
