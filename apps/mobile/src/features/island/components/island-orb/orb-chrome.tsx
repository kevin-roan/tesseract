import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Oval,
  RadialGradient,
  SweepGradient,
  vec,
  type Transforms3d,
} from "@shopify/react-native-skia";
import type { StyleProp, ViewStyle } from "react-native";
import { useDerivedValue, type DerivedValue, type SharedValue } from "react-native-reanimated";

import {
  ISLAND_ORB_BEZEL_WIDTH,
  ISLAND_ORB_CANVAS_PAD,
  ISLAND_ORB_CHROME,
  ISLAND_ORB_DROP_SHADOW,
  ISLAND_ORB_FACE,
  ISLAND_ORB_INNER_SHADOW,
  ISLAND_ORB_RIM_LIGHT,
  ISLAND_ORB_RING_WIDTH,
  ISLAND_ORB_SHEEN,
  ISLAND_ORB_SPECULAR,
  ISLAND_ORB_TRACK,
} from "../../utils/constants";

export type OrbChromeProps = {
  size: number;
  tint: string;
  live: boolean;
  /** Draws the glowing status dot in the middle; off when a count is shown instead. */
  dot: boolean;
  expanded: boolean;
  spin: DerivedValue<Transforms3d>;
  sheen: DerivedValue<Transforms3d>;
  lift: SharedValue<number>;
  breath: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
};

/** Skia body of the orb: a polished chrome bezel with prismatic glints around a smoked-glass face. */
const OrbChrome = ({ size, tint, live, dot, expanded, spin, sheen, lift, breath, style }: OrbChromeProps) => {
  const c = size / 2 + ISLAND_ORB_CANVAS_PAD;
  const center = vec(c, c);
  const radius = size / 2;
  const face = radius - ISLAND_ORB_BEZEL_WIDTH;
  const ring = face - ISLAND_ORB_RING_WIDTH * 1.75;

  const shadowY = useDerivedValue(() => c + 3 + 6 * lift.get());
  const shadowBlur = useDerivedValue(() => 5 + 7 * lift.get());
  const glow = useDerivedValue(() => (live ? 0.25 + 0.45 * breath.get() : 0));
  const halo = useDerivedValue(() => (live ? 0.12 + 0.18 * breath.get() + 0.2 * lift.get() : 0.08 * lift.get()));

  return (
    <Canvas style={style} pointerEvents="none">
      <Circle cx={c} cy={shadowY} r={radius - 1} color={ISLAND_ORB_DROP_SHADOW}>
        <BlurMask blur={shadowBlur} style="normal" />
      </Circle>
      <Circle cx={c} cy={c} r={radius} color={tint} opacity={halo}>
        <BlurMask blur={10} style="outer" />
      </Circle>

      <Group transform={sheen} origin={center}>
        <Circle cx={c} cy={c} r={radius}>
          <SweepGradient c={center} colors={ISLAND_ORB_CHROME.colors} positions={ISLAND_ORB_CHROME.positions} />
        </Circle>
      </Group>
      <Circle cx={c} cy={c} r={radius - 0.5} style="stroke" strokeWidth={1}>
        <LinearGradient start={vec(c, c - radius)} end={vec(c, c + radius)} colors={ISLAND_ORB_RIM_LIGHT} />
      </Circle>

      <Circle cx={c} cy={c} r={face}>
        <RadialGradient c={vec(c, c - face * 0.75)} r={face * 2} colors={ISLAND_ORB_FACE} />
      </Circle>
      <Circle cx={c} cy={c} r={face - 0.75} style="stroke" strokeWidth={1.5} color={ISLAND_ORB_INNER_SHADOW}>
        <BlurMask blur={1.5} style="normal" />
      </Circle>
      {expanded ? <Circle cx={c} cy={c} r={face} color={tint} opacity={0.08} /> : null}

      <Circle cx={c} cy={c} r={ring} style="stroke" strokeWidth={ISLAND_ORB_RING_WIDTH} color={ISLAND_ORB_TRACK} />
      {live ? (
        <Group transform={spin} origin={center}>
          <Circle cx={c} cy={c} r={ring} style="stroke" strokeWidth={ISLAND_ORB_RING_WIDTH} strokeCap="round">
            <SweepGradient c={center} colors={["transparent", "transparent", tint]} />
          </Circle>
        </Group>
      ) : null}

      {dot ? (
        <Group>
          <Circle cx={c} cy={c} r={7} color={tint} opacity={glow}>
            <BlurMask blur={5} style="normal" />
          </Circle>
          <Circle cx={c} cy={c} r={4} color={tint} />
          <Circle cx={c - 1.2} cy={c - 1.4} r={1.2} color={ISLAND_ORB_SPECULAR} opacity={0.55} />
        </Group>
      ) : null}

      <Oval x={c - face * 0.72} y={c - face + 1.5} width={face * 1.44} height={face * 0.85}>
        <LinearGradient start={vec(c, c - face)} end={vec(c, c)} colors={ISLAND_ORB_SHEEN} />
      </Oval>
    </Canvas>
  );
};

export default OrbChrome;
