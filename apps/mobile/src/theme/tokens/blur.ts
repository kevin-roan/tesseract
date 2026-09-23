/**
 * Blur intensities for `expo-blur`, used as the fallback when the platform has
 * no native liquid glass. Values are the 0–100 scale `BlurView` expects.
 */
export const BlurIntensity = {
  /** 20 — barely there; pills and small chrome over busy content */
  light: 20,
  /** 40 — the default surface blur */
  medium: 40,
  /** 70 — sheets and modals that must hide what is behind them */
  heavy: 70,
} as const;

export type BlurToken = keyof typeof BlurIntensity;
