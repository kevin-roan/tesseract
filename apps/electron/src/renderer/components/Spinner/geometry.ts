const ARC_FRACTION = 0.3;

function geometry(size: number, stroke: number) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return { radius, stroke, dash: circumference * ARC_FRACTION, gap: circumference * (1 - ARC_FRACTION) };
}

export const SPINNER_TRACK_OPACITY = 0.15;

export const SPINNER_GEOMETRY = {
  12: geometry(12, 1.5),
  14: geometry(14, 1.75),
  16: geometry(16, 2),
  20: geometry(20, 2.5),
  24: geometry(24, 3),
} as const;
