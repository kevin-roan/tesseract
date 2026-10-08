import { Gesture } from "react-native-gesture-handler";
import {
  cancelAnimation,
  interpolateColor,
  useDerivedValue,
  useSharedValue,
  withDecay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useAnimatedColors } from "@/hooks/use-animated-colors";
import { useLoopClock } from "@/hooks/use-loop-clock";
import { playHaptic } from "@/lib/haptics";
import { linearTiming } from "@/lib/motion";
import { Durations } from "@/theme";

import { GLASS_TESSERACT, glassFrame } from "./geometry";

const { pitch: PITCH, dragRate, loop, colors, colorPeriod } = GLASS_TESSERACT;

const clamp = (value: number, min: number, max: number) => {
  "worklet";
  return Math.min(max, Math.max(min, value));
};

/**
 * Pose, colors and gestures for the glass tesseract. Dragging turns it and lets it
 * coast to a stop, then it eases back to its resting tilt and keeps spinning; a tap
 * flares the core and folds the inner cube through the fourth axis.
 */
export function useGlassTesseract(size: number) {
  const t = useLoopClock(loop);
  const yaw = useSharedValue(0);
  const pitch = useSharedValue<number>(PITCH.rest);
  const flare = useSharedValue(0);
  const origin = useSharedValue({ yaw: 0, pitch: 0 });

  const core = useAnimatedColors(colors, colorPeriod);
  const tint = useAnimatedColors(colors, colorPeriod, 0.5);
  const glass = useDerivedValue(() => interpolateColor(0.55, [0, 1], [tint.value, "#ffffff"]));
  const edge = useDerivedValue(() => interpolateColor(0.75, [0, 1], [tint.value, "#ffffff"]));
  const heat = useDerivedValue(() => interpolateColor(0.35 + flare.value * 0.4, [0, 1], [core.value, "#ffffff"]));

  const frame = useDerivedValue(() =>
    glassFrame({ t: t.value, yaw: yaw.value, pitch: pitch.value, flare: flare.value }, size),
  );

  const pan = Gesture.Pan()
    .onBegin(() => {
      cancelAnimation(yaw);
      cancelAnimation(pitch);
      origin.set({ yaw: yaw.get(), pitch: pitch.get() });
    })
    .onUpdate((event) => {
      yaw.set(origin.get().yaw + event.translationX * dragRate);
      pitch.set(clamp(origin.get().pitch + event.translationY * dragRate, -PITCH.max, PITCH.max));
    })
    .onFinalize((event) => {
      yaw.set(withDecay({ velocity: event.velocityX * dragRate }));
      pitch.set(withTiming(PITCH.rest, linearTiming(Durations.slowest)));
    });

  const tap = Gesture.Tap().onEnd(() => {
    flare.set(
      withSequence(withTiming(1, linearTiming(Durations.fast)), withTiming(0, linearTiming(Durations.slowest * 2))),
    );
    scheduleOnRN(playHaptic, "tap");
  });

  return { gesture: Gesture.Race(pan, tap), t, frame, flare, core, glass, edge, heat };
}
