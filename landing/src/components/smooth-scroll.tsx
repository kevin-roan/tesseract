"use client";

import type { ReactNode } from "react";
import { ReactLenis } from "lenis/react";
import { useReducedMotion } from "motion/react";

export default function SmoothScroll({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <>{children}</>;

  return (
    <ReactLenis root options={{ lerp: 0.09, wheelMultiplier: 1, anchors: { offset: -72 }, autoRaf: true }}>
      {children}
    </ReactLenis>
  );
}
