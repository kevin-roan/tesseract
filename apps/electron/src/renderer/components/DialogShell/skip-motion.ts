import { MotionGlobalConfig } from "motion/react";

export function skipMotionInTests(): () => void {
  const previous = MotionGlobalConfig.skipAnimations;
  MotionGlobalConfig.skipAnimations = true;
  return () => {
    MotionGlobalConfig.skipAnimations = previous;
  };
}
