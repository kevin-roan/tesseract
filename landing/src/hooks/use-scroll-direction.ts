"use client";

import { useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";

export function useScrollDirection(threshold = 8) {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (current) => {
    const previous = scrollY.getPrevious() ?? 0;
    const delta = current - previous;
    setScrolled(current > 24);
    if (Math.abs(delta) < threshold) return;
    setHidden(delta > 0 && current > 240);
  });

  return { hidden, scrolled };
}
