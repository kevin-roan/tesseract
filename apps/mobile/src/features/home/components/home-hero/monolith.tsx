import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import {
  BlurMask,
  Canvas,
  Circle,
  FractalNoise,
  Group,
  LinearGradient,
  Path,
  Rect,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import { useAppTheme } from "@/hooks/use-app-theme";
import { monolithInk } from "@/features/home/utils/monolith";

import { MONOLITH, monolithPaths } from "./monolith-geometry";
import { SCENE_LOOP, frac, sparkState, useSceneClock } from "./scene-clock";

const { height, tipY, roofHeight } = MONOLITH;

/** Dust motes drifting up through the light: horizontal offset, loops per scene, start phase, size. */
const MOTES = [
  [-64, 2, 0.1, 0.9],
  [-40, 3, 0.55, 0.7],
  [-52, 4, 0.8, 0.8],
  [44, 2, 0.25, 0.9],
  [62, 3, 0.45, 0.7],
  [36, 4, 0.05, 0.8],
] as const;

type MoteProps = { t: SharedValue<number>; cx: number; offset: number; loops: number; phase: number; size: number; color: string };

const Mote = ({ t, cx: center, offset, loops, phase, size, color }: MoteProps) => {
  const progress = useDerivedValue(() => frac((t.value * loops) / SCENE_LOOP + phase));
  const cx = useDerivedValue(() => center + offset + Math.sin(progress.value * Math.PI * 2 + offset) * 4);
  const cy = useDerivedValue(() => height - progress.value * (height - tipY + 40));
  const opacity = useDerivedValue(() => Math.sin(progress.value * Math.PI) * 0.22);
  return <Circle cx={cx} cy={cy} r={size} color={color} opacity={opacity} />;
};

/**
 * The splash obelisk, alive: a satin lit face and a near-black shaded face with
 * fine grain, crisp edge light, and a base that sinks into the screen. A spark
 * climbs the ridge every few seconds and lights the roof where it lands, a band
 * of light follows it up the faces, and dust drifts slowly around it.
 */
const Monolith = () => {
  const theme = useAppTheme();
  const ink = useMemo(() => monolithInk(theme), [theme]);
  const { width } = useWindowDimensions();
  const CX = width / 2;
  const { lit, shade, litRoof, shadeRoof, tip, shoulderY, left, right } = useMemo(
    () => monolithPaths(width),
    [width],
  );
  const t = useSceneClock();

  const spark = useDerivedValue(() => sparkState(t.value));
  const sparkY = useDerivedValue(() => height - (height - tipY) * spark.value.climb);
  const sparkOpacity = useDerivedValue(() => spark.value.visible);

  const tail = 56;
  const trailStart = useDerivedValue(() => ({ x: CX, y: sparkY.value + tail }));
  const trailEnd = useDerivedValue(() => ({ x: CX, y: sparkY.value }));
  const bandStart = useDerivedValue(() => ({ x: 0, y: sparkY.value - 44 }));
  const bandEnd = useDerivedValue(() => ({ x: 0, y: sparkY.value + 44 }));
  const bandOpacity = useDerivedValue(() => sparkOpacity.value * 0.28);
  const litRoofOpacity = useDerivedValue(() => 0.75 + spark.value.flare * 0.25);
  const shadeRoofOpacity = useDerivedValue(() => 0.18 + spark.value.flare * 0.5);
  const body = height - tipY;

  return (
    <Canvas style={{ width, height }}>
      {MOTES.map(([offset, loops, phase, size], index) => (
        <Mote key={index} t={t} cx={CX} offset={offset} loops={loops} phase={phase} size={size} color={ink.ink} />
      ))}
      <Group layer>
        {/* Lit face: bright under the roof, settling to satin grey, rounded off toward its outer edge. */}
        <Path path={lit}>
          <LinearGradient
            start={{ x: 0, y: tipY }}
            end={{ x: 0, y: height }}
            colors={ink.face}
            positions={[0, 0.35, 1]}
          />
        </Path>
        <Path path={lit}>
          <LinearGradient
            start={{ x: left, y: 0 }}
            end={{ x: CX, y: 0 }}
            colors={ink.faceShade}
            positions={[0, 0.6, 1]}
          />
        </Path>
        {/* Shaded face: darker than the screen, with a faint sky reflection near the top. */}
        <Path path={shade} color={ink.shade} />
        <Path path={shade}>
          <LinearGradient
            start={{ x: right, y: shoulderY }}
            end={{ x: CX, y: shoulderY + body * 0.6 }}
            colors={ink.shadeSheen}
          />
        </Path>
        {/* Stone grain, like the splash. */}
        <Rect x={left} y={tipY} width={right - left} height={body} blendMode="srcATop" opacity={0.07}>
          <FractalNoise freqX={0.9} freqY={0.9} octaves={3} />
        </Rect>
        {/* Light from the spark spilling across both faces as it climbs. */}
        <Rect x={0} y={0} width={width} height={height} blendMode="srcATop" opacity={bandOpacity}>
          <LinearGradient
            start={bandStart}
            end={bandEnd}
            colors={["transparent", ink.glow, "transparent"]}
            positions={[0, 0.5, 1]}
            mode="decal"
          />
        </Rect>
        {/* Ridge where the faces meet, catching a little light. */}
        <Rect x={CX - 0.5} y={tipY} width={1} height={body}>
          <LinearGradient
            start={{ x: CX, y: tipY }}
            end={{ x: CX, y: tipY + body * 0.7 }}
            colors={ink.ridge}
          />
        </Rect>
        {/* Silhouette edge of the shaded face against the screen. */}
        <Rect x={right - 0.5} y={shoulderY} width={0.5} height={body}>
          <LinearGradient
            start={{ x: right, y: shoulderY }}
            end={{ x: right, y: shoulderY + body * 0.5 }}
            colors={ink.edge}
          />
        </Rect>
        <Group opacity={sparkOpacity}>
          <Rect x={CX - 1} y={tipY} width={2} height={body}>
            <LinearGradient start={trailStart} end={trailEnd} colors={["transparent", ink.glow]} mode="decal" />
            <BlurMask blur={1.5} style="solid" />
          </Rect>
          <Circle cx={CX} cy={sparkY} r={2} color={ink.glow}>
            <BlurMask blur={3} style="solid" />
          </Circle>
        </Group>
        <Group opacity={litRoofOpacity}>
          <Path path={litRoof} style="stroke" strokeWidth={1} color={ink.ink}>
            <BlurMask blur={0.6} style="solid" />
          </Path>
        </Group>
        <Group opacity={shadeRoofOpacity}>
          <Path path={shadeRoof} style="stroke" strokeWidth={1} color={ink.ink} />
        </Group>
        {/* Sinks the base into the screen, like the splash. */}
        <Rect x={0} y={0} width={width} height={height} blendMode="dstIn">
          <LinearGradient
            start={{ x: 0, y: shoulderY + roofHeight }}
            end={{ x: 0, y: height }}
            colors={["black", "rgba(0, 0, 0, 0.6)", "transparent"]}
            positions={[0, 0.45, 1]}
          />
        </Rect>
      </Group>
    </Canvas>
  );
};

export default Monolith;
