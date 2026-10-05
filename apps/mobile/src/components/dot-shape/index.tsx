import { Canvas, Points, vec, type SkPoint } from "@shopify/react-native-skia";
import type { StyleProp, ViewStyle } from "react-native";
import { useDerivedValue } from "react-native-reanimated";

import { dotPoint } from "./shapes";
import { useShapePhase } from "./use-shape-phase";

export type DotShapeProps = {
  size: number;
  color: string;
  /** Number of dots tracing the outline. */
  dots?: number;
  /** Diameter of every dot. */
  dotSize?: number;
  /** 0 keeps a crisp outline, 1 loosens it into a drifting cloud. */
  scatter?: number;
  animate?: boolean;
  /** Milliseconds each shape is shown, morph included. */
  period?: number;
  /** Index into SHAPE_SIDES to settle on while not animating; holds wherever it stopped when unset. */
  rest?: number;
  style?: StyleProp<ViewStyle>;
};

/** Dots that trace a triangle, then a square, then a circle, easing from one outline into the next. */
const DotShape = ({ size, color, dots = 16, dotSize = 2.5, scatter = 0, animate = true, period = 1600, rest, style }: DotShapeProps) => {
  const phase = useShapePhase(animate, period, rest);
  const center = size / 2;
  const radius = size / 2 - dotSize;

  // Plain loops, no inline callbacks: React Compiler hoists those out of the worklet as non-worklet `_temp` functions.
  const points = useDerivedValue(() => {
    const out: SkPoint[] = [];
    for (let i = 0; i < dots; i += 1) {
      const p = dotPoint(phase.get(), i, dots, scatter);
      out.push(vec(center + p.x * radius, center + p.y * radius));
    }
    return out;
  });

  return (
    <Canvas style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Points points={points} mode="points" color={color} strokeWidth={dotSize} strokeCap="round" />
    </Canvas>
  );
};

export default DotShape;
