import { useReducedMotion } from "motion/react";
import { runtime } from "../../../app/runtime";

export function useInstantSwaps(): boolean {
  const prefersReduced = useReducedMotion();
  return runtime.reducedMotion || prefersReduced === true;
}
