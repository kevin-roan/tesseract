import { FadeIn } from "react-native-reanimated";

import { Durations, Stagger, StaggerCap } from "@/theme";

/** Delay before the `index`-th mark of a chart starts growing. */
export function growDelay(index: number, step: number = Stagger.tight): number {
  return Durations.fast + Math.min(index, StaggerCap) * step;
}

/** Fade for the `row`-th row of a grid chart: whole rows arrive one after another, not cell by cell. */
export function rowFadeIn(row: number) {
  return FadeIn.delay(Durations.fast + row * Stagger.normal).duration(Durations.slow);
}
