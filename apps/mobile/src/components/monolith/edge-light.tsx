import { useMemo } from "react";
import { BlurMask, Group, Path } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { ObeliskGeometry } from "@/components/splash-overlay/geometry";
import { segment } from "@/hooks/use-splash-timeline";

import { obeliskEdges } from "./geometry";

export type EdgeLightProps = {
  geometry: ObeliskGeometry;
  clock: SharedValue<number>;
  color: string;
};

/** A thin light that draws along the obelisk's edges from the tip, then settles to a faint rim. */
const EdgeLight = ({ geometry, clock, color }: EdgeLightProps) => {
  const edges = useMemo(() => obeliskEdges(geometry), [geometry]);
  const roofEnd = useDerivedValue(() => segment(clock.value, 0.1, 0.5));
  const sideEnd = useDerivedValue(() => segment(clock.value, 0.4, 1));
  const opacity = useDerivedValue(() => 0.9 - segment(clock.value, 0.7, 1) * 0.45);

  const strokes = [
    ...edges.roof.map((path) => ({ path, end: roofEnd, weight: 1 })),
    ...edges.sides.map((path) => ({ path, end: sideEnd, weight: 0.6 })),
    { path: edges.ridge, end: sideEnd, weight: 0.5 },
  ];

  return (
    <Group opacity={opacity}>
      {strokes.map(({ path, end, weight }, index) => (
        <Group key={index} opacity={weight}>
          <Path path={path} style="stroke" strokeWidth={2.5} color={color} opacity={0.35} start={0} end={end}>
            <BlurMask blur={3} style="normal" />
          </Path>
          <Path path={path} style="stroke" strokeWidth={0.75} color={color} start={0} end={end} />
        </Group>
      ))}
    </Group>
  );
};

export default EdgeLight;
