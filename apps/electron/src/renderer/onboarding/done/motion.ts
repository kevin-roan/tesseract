import { EASE } from "../../theme/motion";
import { HERO_CHECK } from "./constants";

export function drawStroke(delayMs: number) {
  return {
    initial: { pathLength: 0 },
    animate: { pathLength: 1 },
    transition: {
      duration: HERO_CHECK.drawMs / 1000,
      ease: EASE.decelerate,
      delay: delayMs / 1000,
    },
  };
}
