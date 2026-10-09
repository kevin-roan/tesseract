import { useMemo } from "react";
import { usePathValue } from "@shopify/react-native-skia";

import { obeliskCrop } from "@/components/splash-overlay/geometry";
import { useLoopClock } from "@/hooks/use-loop-clock";

import { MONOLITH } from "./constants";
import { particleField, traceParticles } from "./geometry";

/** Image placement, edge geometry and drifting particles for a `width` × `height` monolith. */
export function useMonolith(width: number, height: number, span?: number) {
  const crop = useMemo(() => obeliskCrop(width, height, span), [width, height, span]);
  const field = useMemo(() => particleField(MONOLITH.particles, MONOLITH.particleSize), []);
  const t = useLoopClock(MONOLITH.drift);
  const particles = usePathValue((path) => {
    "worklet";
    traceParticles(path, field, t.value / MONOLITH.drift, width, height);
  });

  return { ...crop, particles };
}
