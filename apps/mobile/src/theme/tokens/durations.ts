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
  /** Slight overshoot for playful affordances. */
  overshoot: [0.34, 1.56, 0.64, 1],
  linear: [0, 0, 1, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type EasingToken = keyof typeof Easings;

/** `withSpring` configs (Reanimated). Prefer these over durations for gestures. */
export const Springs = {
  /** Crisp, no visible bounce — default for interactive drags. */
  snappy: { damping: 22, stiffness: 260, mass: 1 },
  /** Soft settle — sheets, cards. */
  gentle: { damping: 26, stiffness: 140, mass: 1 },
  /** Visible bounce — celebratory moments only. */
  bouncy: { damping: 12, stiffness: 200, mass: 0.9 },
  /** Near-instant, for values that follow a finger. */
  responsive: { damping: 30, stiffness: 420, mass: 0.8 },
} as const;

export type SpringToken = keyof typeof Springs;

/** Delay between children in a staggered list/grid entrance. */
export const Stagger = {
  tight: 24,
  normal: 40,
  loose: 70,
} as const;

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
