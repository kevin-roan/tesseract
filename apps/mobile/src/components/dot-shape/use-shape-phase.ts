import { useEffect } from "react";
import { cancelAnimation, Easing, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { SHAPE_SIDES } from "./shapes";

const SETTLE_MS = 400;

/**
 * Loops 0 → SHAPE_SIDES.length, one shape per `period`, while `animate`. Otherwise eases onto the
 * `rest` shape index, or holds wherever it stopped when there is none; jumps straight there under reduced motion.
 */
export function useShapePhase(animate: boolean, period: number, rest?: number) {
  const reduced = useReducedMotion();
  const phase = useSharedValue(rest ?? 0);

  useEffect(() => {
    if (!animate || reduced) {
      cancelAnimation(phase);
      if (rest !== undefined) {
        phase.set(reduced ? rest : withTiming(rest, { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) }));
      }
      return;
    }
    const shapes = SHAPE_SIDES.length;
    phase.set(0);
    phase.set(withRepeat(withTiming(shapes, { duration: period * shapes, easing: Easing.linear }), -1));
    return () => cancelAnimation(phase);
  }, [animate, reduced, period, rest, phase]);

  return phase;
}
