import { useCallback } from "react";
import { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { useScrambleText } from "@/hooks/use-scramble-text";
import { playHaptic } from "@/lib/haptics";
import { linearTiming } from "@/lib/motion";
import { Durations, ScrambleMotion } from "@/theme";

/** Long-press easter egg: the letters decode from noise while the rule redraws underneath. */
export function useWordmarkDecode(text: string) {
  const scramble = useScrambleText(text);
  const rule = useSharedValue(1);

  const play = useCallback(() => {
    if (scramble.playing) return;
    playHaptic("selection");
    scramble.play();
    rule.set(
      withSequence(
        withTiming(0, linearTiming(Durations.fast)),
        withTiming(1, linearTiming(ScrambleMotion.duration - Durations.fast)),
      ),
    );
  }, [rule, scramble]);

  const ruleStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: rule.get() }] }));

  return { letters: scramble.letters, play, ruleStyle };
}
