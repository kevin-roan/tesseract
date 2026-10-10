/**
 * Motion tokens. Durations are milliseconds; easings are cubic-bezier control
 * points that map directly onto `Easing.bezier(...)` (Reanimated / RN Easing)
 * and onto `cubic-bezier(...)` on web.
 *
 * Rule of thumb: the larger the element travels, the longer it takes. Anything
 * the user triggers by touch should land under ~250ms or it feels laggy.
 */

export const Durations = {
  /** No animation — respect for reduced motion, or instant state flips. */
  instant: 0,
  /** 80 — micro feedback: press highlight, checkbox tick */
  fastest: 80,
  /** 140 — hover/focus, small fades, ripples */
  fast: 140,
  /** 220 — the default: expand/collapse, tab switch, toast in */
  normal: 220,
  /** 320 — sheets, dialogs, list item enter */
  slow: 320,
  /** 480 — full-screen transitions, hero moves */
  slower: 480,
  /** 720 — splash hand-off, onboarding illustrations */
  slowest: 720,
} as const;

export type DurationToken = keyof typeof Durations;

/** Cubic-bezier control points: [x1, y1, x2, y2]. */
export const Easings = {
  /** Everything that starts and ends on screen. */
  standard: [0.2, 0, 0, 1],
  /** Entering: fast start, soft landing. */
  decelerate: [0, 0, 0, 1],
  /** Exiting: soft start, fast off-screen. */
  accelerate: [0.3, 0, 1, 1],
  /** Large, expressive moves (sheets, hero). */
  emphasized: [0.2, 0, 0, 1],
  linear: [0, 0, 1, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type EasingToken = keyof typeof Easings;

/** How far a pressed element sinks (`usePressScale`): cards barely, small controls a little more. */
export const PressScale = {
  card: 0.98,
  control: 0.95,
} as const;

/** Delay between children in a staggered list/grid entrance. */
export const Stagger = {
  tight: 24,
  normal: 40,
  loose: 70,
} as const;

/** Items past this position in a staggered entrance arrive with the last delayed one. */
export const StaggerCap = 10;

/** Assistant-specific timings, shared between chat UI and voice UI. */
export const Timings = {
  /** One cycle of the three-dot "thinking" indicator. */
  typingIndicator: 1200,
  /** Text cursor blink while a response streams. */
  streamCursorBlink: 620,
  /** How long a streamed chunk fades in for. */
  streamChunkFade: 160,
  /** Mic level meter refresh. */
  voiceMeter: 100,
  /** Toast / snackbar visible time before auto-dismiss. */
  toast: 4000,
  /** Debounce before firing a search request. */
  searchDebounce: 300,
  /** Long-press to open a message action menu. */
  longPress: 500,
} as const;

/** Ambient chart motion on data visuals (cell matrices, bar strips). */
export const ChartMotion = {
  /** Bottom-up reveal when a chart becomes active. */
  reveal: Durations.slowest * 2,
  /** One pulse cycle of a matrix's live cells. */
  pulse: Durations.slowest * 4,
  /** One full scroll of a streaming bar strip. */
  stream: Durations.slowest * 20,
  /** Opacity a live cell dims to at the bottom of its pulse. */
  pulseFloor: 0.35,
} as const;

/** Launch splash: one intro clock, then the hand-off into the app. */
export const SplashMotion = {
  /** Wordmark, edge lines and light sweep play inside this window. */
  intro: Durations.slowest * 2.5,
  /** Overlay fade and image push once the app is ready. */
  exit: Durations.slower,
  /** Delay per step out from the middle wordmark letter, as a fraction of the intro. */
  letterStagger: 0.07,
  /** How long one letter takes to settle, as a fraction of the intro. */
  letterSettle: 0.45,
} as const;

/** Wordmark easter egg: letters cycle through random capitals, then settle left to right. */
export const ScrambleMotion = {
  /** From the first scrambled frame to the last letter settling. */
  duration: Durations.slowest * 2,
  /** How often the unsettled letters pick a new glyph. */
  frame: 45,
  /** Share of the run spent fully scrambled before the first letter settles. */
  hold: 0.25,
} as const;
