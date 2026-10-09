import { useMemo, useState } from "react";
import type { LayoutChangeEvent } from "react-native";

import { useMonolithIntro } from "@/components/monolith/use-monolith-intro";

import { heroBox, type Size } from "../utils/hero";

export function useHomeHero() {
  const [panel, setPanel] = useState<Size>({ width: 0, height: 0 });
  const box = useMemo(() => heroBox(panel), [panel]);
  const clock = useMonolithIntro();

  const measure = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== panel.width || height !== panel.height) setPanel({ width, height });
  };

  return { box, clock, measure, ready: box.width > 0 && box.height > 0 };
}
