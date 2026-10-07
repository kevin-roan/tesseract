import { MotionGlobalConfig } from "motion/react";
import { afterAll, beforeAll } from "vitest";

export function skipMotionDuringTests(): void {
  let previous: boolean | undefined;
  beforeAll(() => {
    previous = MotionGlobalConfig.skipAnimations;
    MotionGlobalConfig.skipAnimations = true;
  });
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = previous;
  });
}
