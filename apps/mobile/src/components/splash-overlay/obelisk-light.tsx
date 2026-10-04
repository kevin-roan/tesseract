import { useMemo } from "react";
import { BlurMask, Circle, Group, LinearGradient, Path, RadialGradient, Rect, Skia } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import { segment } from "@/hooks/use-splash-timeline";

import type { ObeliskGeometry } from "./geometry";

export type ObeliskLightProps = {
  geometry: ObeliskGeometry;
  clock: SharedValue<number>;
  color: string;
};

/**
 * Light that traces the obelisk in the splash image: a glow opens at the tip,
 * the two roof edges draw out from it, then a spark runs down the ridge.
 */
const ObeliskLight = ({ geometry, clock, color }: ObeliskLightProps) => {
  const { tip, leftShoulder, rightShoulder, ridgeBottom, scale } = geometry;
  const glowRadius = scale * 900;
  const tail = scale * 700;

  const [leftEdge, rightEdge] = useMemo(
    () =>
      [leftShoulder, rightShoulder].map((shoulder) => {
        const path = Skia.Path.Make();
        path.moveTo(tip.x, tip.y);
        path.lineTo(shoulder.x, shoulder.y);
        return path;
      }),
    [tip, leftShoulder, rightShoulder],
  );

  const glow = useDerivedValue(() => segment(clock.value, 0.25, 0.8) * 0.22);
  const edgeEnd = useDerivedValue(() => segment(clock.value, 0.3, 0.7));
  const edgeOpacity = useDerivedValue(() => 0.85 - segment(clock.value, 0.75, 1) * 0.55);

  const head = useDerivedValue(() => tip.y + (ridgeBottom - tip.y + tail) * segment(clock.value, 0.45, 1));
  const sparkStart = useDerivedValue(() => ({
    x: tip.x,
    y: head.value - tail,
  }));
  const sparkEnd = useDerivedValue(() => ({ x: tip.x, y: head.value }));

  return (
    <Group>
      <Circle cx={tip.x} cy={tip.y} r={glowRadius} opacity={glow}>
        <RadialGradient c={tip} r={glowRadius} colors={[color, "transparent"]} />
      </Circle>
      <Group opacity={edgeOpacity}>
        {[leftEdge, rightEdge].map((edge, index) => (
          <Path key={index} path={edge} style="stroke" strokeWidth={1} color={color} start={0} end={edgeEnd}>
            <BlurMask blur={1.5} style="solid" />
          </Path>
        ))}
      </Group>
      <Rect x={tip.x - 1} y={tip.y} width={2} height={ridgeBottom - tip.y}>
        <LinearGradient start={sparkStart} end={sparkEnd} colors={["transparent", color]} mode="decal" />
        <BlurMask blur={2} style="solid" />
      </Rect>
    </Group>
  );
};

export default ObeliskLight;
