import { useMemo } from "react";
import { View } from "react-native";
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Path,
  Points,
  RadialGradient,
  Rect,
  usePathValue,
  vec,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import { useAppTheme } from "@/hooks/use-app-theme";
import { useLoopClock } from "@/hooks/use-loop-clock";
import type { ThemeColor } from "@/theme";

import {
  TESSERACT_ECHOES,
  TESSERACT_EDGES,
  TESSERACT_LOOP,
  starField,
  tesseractPoints,
  traceEdges,
  traceStars,
} from "./geometry";

export type TesseractProps = {
  size: number;
  color?: ThemeColor;
  /** Number of streaking stars behind the figure. */
  stars?: number;
  testID?: string;
};

type FrameProps = {
  t: SharedValue<number>;
  size: number;
  color: string;
  /** Seconds this frame trails the live pose; echoes lag behind and fade. */
  lag?: number;
  opacity?: number;
  glow?: boolean;
};

const Frame = ({ t, size, color, lag = 0, opacity = 1, glow = false }: FrameProps) => {
  const points = useDerivedValue(() => tesseractPoints(t.value - lag, size));
  const near = usePathValue((path) => {
    "worklet";
    traceEdges(path, points.value, TESSERACT_EDGES.near);
  });
  const far = usePathValue((path) => {
    "worklet";
    traceEdges(path, points.value, TESSERACT_EDGES.far);
  });
  const struts = usePathValue((path) => {
    "worklet";
    traceEdges(path, points.value, TESSERACT_EDGES.struts);
  });
  const stroke = Math.max(1, size / 220);

  return (
    <Group opacity={opacity}>
      {glow ? (
        <Group opacity={0.55}>
          <Path path={near} style="stroke" strokeWidth={stroke * 3} color={color}>
            <BlurMask blur={6} style="normal" />
          </Path>
          <Path path={far} style="stroke" strokeWidth={stroke * 3} color={color} opacity={0.6}>
            <BlurMask blur={6} style="normal" />
          </Path>
        </Group>
      ) : null}
      <Path path={struts} style="stroke" strokeWidth={stroke * 0.75} color={color} opacity={0.45} />
      <Path path={far} style="stroke" strokeWidth={stroke} color={color} opacity={0.7} />
      <Path path={near} style="stroke" strokeWidth={stroke} color={color} />
      {glow ? (
        <Points points={points} mode="points" color={color} strokeWidth={stroke * 3.5} strokeCap="round">
          <BlurMask blur={1.5} style="solid" />
        </Points>
      ) : null}
    </Group>
  );
};

/**
 * A slowly turning four-dimensional cube in the spirit of Interstellar's tesseract:
 * its inner and outer cubes trade places as it rotates through the fourth axis,
 * faint echoes of earlier poses trail behind it, and stars streak outward past it.
 * Monochrome, drawn in one theme ink; it holds still while hidden or with reduced motion.
 */
const Tesseract = ({ size, color = "text", stars = 56, testID }: TesseractProps) => {
  const theme = useAppTheme();
  const ink = theme.colors[color];
  const t = useLoopClock(TESSERACT_LOOP, TESSERACT_LOOP * 0.1);
  const field = useMemo(() => starField(stars), [stars]);
  const streaks = usePathValue((path) => {
    "worklet";
    traceStars(path, field, t.value, size);
  });
  const center = size / 2;

  return (
    <View testID={testID} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Canvas style={{ width: size, height: size }}>
        <Circle cx={center} cy={center} r={size * 0.22} color={ink} opacity={0.07}>
          <BlurMask blur={size * 0.12} style="normal" />
        </Circle>
        <Group layer>
          <Path path={streaks} style="stroke" strokeWidth={1} strokeCap="round" color={ink} opacity={0.5} />
          <Rect x={0} y={0} width={size} height={size} blendMode="dstIn">
            <RadialGradient
              c={vec(center, center)}
              r={center}
              colors={["transparent", "black", "black", "transparent"]}
              positions={[0, 0.3, 0.75, 1]}
            />
          </Rect>
        </Group>
        {TESSERACT_ECHOES.map((echo) => (
          <Frame key={echo.lag} t={t} size={size} color={ink} lag={echo.lag} opacity={echo.opacity} />
        ))}
        <Frame t={t} size={size} color={ink} glow />
      </Canvas>
    </View>
  );
};

export default Tesseract;
