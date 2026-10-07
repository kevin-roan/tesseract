import type { Transition, Variants } from "motion/react";

export const DURATION_MS = {
  instant: 0,
  fastest: 60,
  fast: 120,
  normal: 180,
  slow: 260,
  slower: 400,
  slowest: 720,
} as const;

export const EASE = {
  standard: [0.2, 0, 0, 1],
  decelerate: [0, 0, 0, 1],
  accelerate: [0.3, 0, 1, 1],
  emphasized: [0.2, 0, 0, 1],
  overshoot: [0.34, 1.56, 0.64, 1],
  linear: [0, 0, 1, 1],
} as const satisfies Record<string, [number, number, number, number]>;

export const PRESS_SCALE = { control: 0.95, card: 0.98 } as const;

export const LOOP_MS = {
  pulse: 2880,
  shimmer: 1440,
  chartReveal: 1440,
  dotSphereTurn: 7200,
  spinner: 1000,
} as const;

export const seconds = (ms: number) => ms / 1000;

export const transition = {
  fast: { duration: seconds(DURATION_MS.fast), ease: EASE.standard },
  normal: { duration: seconds(DURATION_MS.normal), ease: EASE.standard },
  slow: { duration: seconds(DURATION_MS.slow), ease: EASE.standard },
  exit: { duration: seconds(DURATION_MS.fast), ease: EASE.accelerate },
  overshoot: { duration: seconds(DURATION_MS.normal), ease: EASE.overshoot },
} as const satisfies Record<string, Transition>;

export const fade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: transition.normal },
  exit: { opacity: 0, transition: transition.exit },
};

export const pageEnter: Variants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: transition.normal },
  exit: { opacity: 0, transition: transition.exit },
};

export const popover: Variants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1, transition: transition.fast },
  exit: { opacity: 0, scale: 0.98, transition: transition.exit },
};

export const dialog: Variants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1, transition: transition.normal },
  exit: { opacity: 0, scale: 0.98, transition: transition.exit },
};

export const toast: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: transition.normal },
  exit: { opacity: 0, y: 8, transition: transition.exit },
};

export const rise: Variants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: transition.fast },
  exit: { opacity: 0, transition: transition.exit },
};

export const reveal: Variants = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto", transition: transition.normal },
  exit: { opacity: 0, height: 0, transition: transition.normal },
};

export const STAGGER_MS = { checks: 30, rows: 15 } as const;
export const STAGGER_ROW_CAP = 20;

export function stagger(index: number, stepMs: number, cap = STAGGER_ROW_CAP): Transition {
  return { ...transition.fast, delay: seconds(Math.min(index, cap) * stepMs) };
}
