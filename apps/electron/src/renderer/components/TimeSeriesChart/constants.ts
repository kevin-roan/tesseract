export const CEILING_STEPS = [1, 1.25, 1.5, 2, 3, 4, 5, 6, 8, 10] as const;
export const TICK_MULTIPLIERS = [1, 2, 2.5, 5] as const;
export const TIME_STEPS_S = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200] as const;
export const HEADROOM = 1.04;
export const EPSILON = 1e-9;

export const CHART = {
  defaultHeight: 240,
  lineWidth: 1.5,
  gridWidth: 1,
  fillTopAlpha: 0.12,
  crosshairAlpha: 0.55,
  dotRadius: 3,
  ringWidth: 1.5,
  isolatedRadius: 2,
  labelSize: 11,
  tooltipTitleSize: 11,
  tooltipValueSize: 12,
  emptySize: 12,
  tooltipPadding: 10,
  tooltipRowGap: 4,
  tooltipKeyWidth: 14,
  tooltipInnerGap: 8,
  tooltipGap: 14,
  tooltipRadius: 8,
  tooltipEdge: 2,
  tooltipTop: 4,
  axisGap: 8,
  padTop: 12,
  padRight: 14,
  padBottom: 8,
  minTickSpacing: 92,
  labelGap: 10,
  thresholdDash: [5, 4],
  thresholdAlpha: 0.85,
  platePadding: 4,
  plateAlpha: 0.85,
  redrawIntervalMs: 1000,
  tweenDurationS: 0.35,
  hiddenAlpha: 0.01,
  fontWeightBold: 600,
  fontWeightNormal: 400,
} as const;

export const TABULAR_ADVANCE_EM: Readonly<Record<string, number>> = {
  ...Object.fromEntries("0123456789".split("").map((digit) => [digit, 0.6484])),
  ":": 0.2686,
};

export const NO_HIDDEN_KEYS: readonly string[] = [];

export const FALLBACK_FONT = "Inter, sans-serif";

export const CHART_PALETTE_SIZE = 6;
export const chartColorToken = (index: number) => `chart-${((index % CHART_PALETTE_SIZE) + CHART_PALETTE_SIZE) % CHART_PALETTE_SIZE}`;
