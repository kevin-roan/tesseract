import { useEffect } from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useMonolithIntro } from "@/components/monolith/use-monolith-intro";
import { playHaptic } from "@/lib/haptics";
import { linearTiming } from "@/lib/motion";
import { Durations } from "@/theme";

import { MONOLITH_EGG, eggBox, lookAt } from "../utils/egg";

/**
 * The About screen's easter egg: tap the monolith seven times in a row and it
 * wakes up with a little face, blinking and following your finger. Taps send
 * hearts up from its tip, a long press makes it squint happily, and it dozes
 * off again once left alone.
 */
export function useMonolithEgg(size: number) {
  const box = eggBox(size);
  const clock = useMonolithIntro();

  const streak = useSharedValue(0);
  const wake = useSharedValue(0);
  const blink = useSharedValue(0);
  const happy = useSharedValue(0);
  const lookX = useSharedValue(0);
  const lookY = useSharedValue(0);
  const hearts = useSharedValue(1);
  const sparkAt = useSharedValue({ x: 0, y: 0 });
  const spark = useSharedValue(1);
  const tilt = useSharedValue(0);

  useEffect(() => {
    blink.set(
      withRepeat(
        withSequence(
          withDelay(MONOLITH_EGG.blinkEvery, withTiming(1, linearTiming(Durations.fastest))),
          withTiming(0, linearTiming(Durations.fast)),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(blink);
  }, [blink]);

  const isAwake = () => {
    "worklet";
    return wake.get() > 0.5;
  };

  const stayAwake = () => {
    "worklet";
    wake.set(
      withSequence(
        withTiming(1, linearTiming(Durations.slow)),
        withDelay(MONOLITH_EGG.awakeFor, withTiming(0, linearTiming(Durations.slowest))),
      ),
    );
  };

  const sendHearts = () => {
    "worklet";
    hearts.set(0);
    hearts.set(withTiming(1, linearTiming(Durations.slowest * 3)));
  };

  const nudge = (x: number, y: number, count: number) => {
    "worklet";
    sparkAt.set({ x, y });
    spark.set(0);
    spark.set(withTiming(1, linearTiming(Durations.slow)));
    const side = count % 2 === 0 ? 1 : -1;
    tilt.set(
      withSequence(
        withTiming(side * MONOLITH_EGG.wobble, linearTiming(Durations.fastest)),
        withTiming(0, linearTiming(Durations.fast)),
      ),
    );
  };

  const tap = Gesture.Tap().onEnd((event) => {
    if (isAwake()) {
      stayAwake();
      sendHearts();
      happy.set(withSequence(withTiming(1, linearTiming(Durations.fast)), withTiming(0, linearTiming(Durations.slow))));
      scheduleOnRN(playHaptic, "tap");
      return;
    }

    const count = Math.round(streak.get()) + 1;
    nudge(event.x, event.y, count);
    if (count < MONOLITH_EGG.taps) {
      streak.set(
        withSequence(
          withTiming(count, { duration: 0 }),
          withDelay(MONOLITH_EGG.tapWindow, withTiming(0, { duration: 0 })),
        ),
      );
      scheduleOnRN(playHaptic, "tap");
      return;
    }
    cancelAnimation(streak);
    streak.set(0);
    stayAwake();
    sendHearts();
    scheduleOnRN(playHaptic, "success");
  });

  const press = Gesture.LongPress()
    .onStart(() => {
      if (!isAwake()) return;
      stayAwake();
      happy.set(withTiming(1, linearTiming(Durations.fast)));
      scheduleOnRN(playHaptic, "selection");
    })
    .onFinalize(() => {
      happy.set(withTiming(0, linearTiming(Durations.slow)));
    });

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      if (!isAwake()) return;
      const look = lookAt(event.x, event.y, box.width, box.height);
      lookX.set(look.x);
      lookY.set(look.y);
    })
    .onFinalize(() => {
      lookX.set(withTiming(0, linearTiming(Durations.slow)));
      lookY.set(withTiming(0, linearTiming(Durations.slow)));
      if (isAwake()) stayAwake();
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tilt.value}deg` }],
  }));

  return {
    box,
    clock,
    gesture: Gesture.Race(pan, press, tap),
    style,
    face: { wake, blink, happy, lookX, lookY, hearts, spark, sparkAt },
  };
}
