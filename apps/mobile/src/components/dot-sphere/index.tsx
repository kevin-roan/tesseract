import { useEffect, useMemo } from "react";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { useAppTheme } from "@/hooks/use-app-theme";
import { useScreenActive } from "@/hooks/use-screen-active";
import { Durations, type ThemeColor } from "@/theme";

import { DEPTH_BANDS, FRAMES_PER_TURN, bandOpacity, spherePaths, spherePoints } from "./points";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const TURN = Math.PI * 2;

export type DotSphereProps = {
  size: number;
  /** Number of dots on the surface; small sizes read better with fewer. */
  dots?: number;
  color?: ThemeColor;
  /** Milliseconds for one full turn. */
  period?: number;
};

type BandProps = { paths: SharedValue<string[]>; band: number; color: string };

const Band = ({ paths, band, color }: BandProps) => {
  const animatedProps = useAnimatedProps(() => ({ d: paths.value[band] ?? "" }));
  return <AnimatedPath fill={color} opacity={bandOpacity(band)} animatedProps={animatedProps} />;
};

/**
 * Slowly spinning globe of dots — the "working on it" mark for long-running tasks.
 * Dots are drawn as a few depth bands (one path each) rather than one animated
 * circle per dot, so a frame is a handful of native prop updates instead of
 * hundreds; the spin pauses while the screen is hidden or the app is backgrounded.
 */
const DotSphere = ({ size, dots = 72, color = "text", period = Durations.slowest * 10 }: DotSphereProps) => {
  const theme = useAppTheme();
  const reduceMotion = useReducedMotion();
  const active = useScreenActive();
  const angle = useSharedValue(0);
  const points = useMemo(() => spherePoints(dots), [dots]);
  const dotRadius = Math.max(0.8, size / 60);
  const radius = size / 2 - dotRadius;
  const center = size / 2;

  useEffect(() => {
    if (reduceMotion || !active) return;
    const start = angle.value % TURN;
    angle.value = start;
    angle.value = withRepeat(withTiming(start + TURN, { duration: period, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(angle);
  }, [angle, period, reduceMotion, active]);

  const paths = useSharedValue<string[]>([]);
  useAnimatedReaction(
    () => Math.floor((angle.value / TURN) * FRAMES_PER_TURN),
    (frame, previous) => {
      if (frame === previous) return;
      paths.value = spherePaths(points, (frame / FRAMES_PER_TURN) * TURN, center, radius, dotRadius);
    },
    [points, center, radius, dotRadius],
  );
  const fill = theme.colors[color];

  return (
    <Svg width={size} height={size} accessible={false}>
      {Array.from({ length: DEPTH_BANDS }, (_, band) => (
        <Band key={band} paths={paths} band={band} color={fill} />
      ))}
    </Svg>
  );
};

export default DotSphere;
