import { useMemo } from "react";
import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import {
  BlurMask,
  Canvas,
  Circle,
  FractalNoise,
  Group,
  LinearGradient,
  Oval,
  Path,
  Points,
  Rect,
  usePathValue,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import { TESSERACT_EDGES, traceEdges } from "@/components/tesseract/geometry";

import {
  GLASS_TESSERACT,
  INNER_FACES,
  OUTER_FACES,
  coreCenter,
  moteField,
  traceFaces,
  traceMotes,
  type GlassFrame,
} from "./geometry";
import { useGlassTesseract } from "./use-glass-tesseract";

export type GlassTesseractProps = {
  size: number;
  /** Dust motes drifting around the figure. */
  motes?: number;
  testID?: string;
};

type Colors = {
  core: SharedValue<string>;
  glass: SharedValue<string>;
  edge: SharedValue<string>;
  heat: SharedValue<string>;
};

type CrystalProps = Colors & { frame: SharedValue<GlassFrame>; flare: SharedValue<number>; size: number };

const GlassFace = ({ frame, index, color }: { frame: SharedValue<GlassFrame>; index: number; color: SharedValue<string> }) => {
  const path = usePathValue((p) => {
    "worklet";
    traceFaces(p, frame.value, [index], true);
  });
  const opacity = useDerivedValue(() => 0.07 + (frame.value.faces[index]?.light ?? 0) * 0.26);
  return <Path path={path} color={color} opacity={opacity} />;
};

const Crystal = ({ frame, flare, size, core, glass, edge, heat }: CrystalProps) => {
  const stroke = Math.max(1, size / 200);
  const back = usePathValue((p) => {
    "worklet";
    traceFaces(p, frame.value, OUTER_FACES, false);
  });
  const front = usePathValue((p) => {
    "worklet";
    traceFaces(p, frame.value, OUTER_FACES, true);
  });
  const inner = usePathValue((p) => {
    "worklet";
    traceFaces(p, frame.value, INNER_FACES);
  });
  const outerEdges = usePathValue((p) => {
    "worklet";
    traceEdges(p, frame.value.points, TESSERACT_EDGES.far);
  });
  const innerEdges = usePathValue((p) => {
    "worklet";
    traceEdges(p, frame.value.points, TESSERACT_EDGES.near);
  });
  const struts = usePathValue((p) => {
    "worklet";
    traceEdges(p, frame.value.points, TESSERACT_EDGES.struts);
  });
  const corners = useDerivedValue(() => frame.value.points.slice(8));
  const center = useDerivedValue(() => coreCenter(frame.value));
  const coreX = useDerivedValue(() => center.value.x);
  const coreY = useDerivedValue(() => center.value.y);
  const coreRadius = useDerivedValue(() => size * (0.08 + flare.value * 0.05));
  const coreOpacity = useDerivedValue(() => 0.75 + flare.value * 0.25);

  return (
    <Group>
      <Path path={back} color={glass} opacity={0.08} />
      <Path path={struts} style="stroke" strokeWidth={stroke * 0.75} color={edge} opacity={0.3} />
      <Group opacity={coreOpacity}>
        <Path path={inner} color={core} opacity={0.6}>
          <BlurMask blur={size * 0.03} style="normal" />
        </Path>
        <Circle cx={coreX} cy={coreY} r={coreRadius} color={heat}>
          <BlurMask blur={size * 0.05} style="normal" />
        </Circle>
        <Path path={innerEdges} style="stroke" strokeWidth={stroke * 2.5} color={core}>
          <BlurMask blur={4} style="normal" />
        </Path>
        <Path path={innerEdges} style="stroke" strokeWidth={stroke} color={heat} />
      </Group>
      {OUTER_FACES.map((index) => (
        <GlassFace key={index} frame={frame} index={index} color={glass} />
      ))}
      <Group layer opacity={0.16}>
        <Path path={front} color="white" />
        <Rect x={0} y={0} width={size} height={size} blendMode="srcIn">
          <FractalNoise freqX={0.035} freqY={0.035} octaves={4} />
        </Rect>
      </Group>
      <Path path={outerEdges} style="stroke" strokeWidth={stroke * 4} color={edge} opacity={0.65}>
        <BlurMask blur={8} style="normal" />
      </Path>
      <Path path={outerEdges} style="stroke" strokeWidth={stroke * 1.2} color={edge} />
      <Points points={corners} mode="points" color="white" strokeWidth={stroke * 3} strokeCap="round">
        <BlurMask blur={1.5} style="solid" />
      </Points>
    </Group>
  );
};

/**
 * A glass tesseract with a molten core: the outer cube is frosted glass with lit
 * edges, the inner cube glows and folds through the fourth axis, its hues drift
 * linearly round the spectrum, and it stands on a reflective floor among dust.
 * Drag to turn it, tap to flare the core.
 */
const GlassTesseract = ({ size, motes = 28, testID }: GlassTesseractProps) => {
  const { gesture, t, frame, flare, core, glass, edge, heat } = useGlassTesseract(size);
  const height = size * GLASS_TESSERACT.canvas;
  const floorY = size * GLASS_TESSERACT.floor;
  const field = useMemo(() => moteField(motes), [motes]);
  const dust = usePathValue((p) => {
    "worklet";
    traceMotes(p, field, t.value, size, height);
  });
  const haloOpacity = useDerivedValue(() => 0.16 + flare.value * 0.2);
  const colors = { core, glass, edge, heat };

  return (
    <GestureHandlerRootView testID={testID} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <GestureDetector gesture={gesture}>
        <Canvas style={{ width: size, height }}>
          <Circle cx={size / 2} cy={size / 2} r={size * 0.32} color={core} opacity={haloOpacity}>
            <BlurMask blur={size * 0.16} style="normal" />
          </Circle>
          <Oval x={size * 0.2} y={floorY - size * 0.03} width={size * 0.6} height={size * 0.06} color={core} opacity={0.22}>
            <BlurMask blur={size * 0.04} style="normal" />
          </Oval>
          <Path path={dust} color={edge} opacity={0.55}>
            <BlurMask blur={1} style="solid" />
          </Path>
          <Group layer opacity={0.28}>
            <Group transform={[{ translateY: floorY * 2 }, { scaleY: -1 }]}>
              <Crystal frame={frame} flare={flare} size={size} {...colors} />
            </Group>
            <Rect x={0} y={0} width={size} height={height} blendMode="dstIn">
              <LinearGradient
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: height }}
                colors={["transparent", "transparent", "black", "transparent"]}
                positions={[0, floorY / height, floorY / height + 0.005, 1]}
              />
            </Rect>
          </Group>
          <Crystal frame={frame} flare={flare} size={size} {...colors} />
        </Canvas>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

export default GlassTesseract;
