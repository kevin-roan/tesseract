import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";

import { scrambleFrame, type ScrambleLetter } from "@/lib/scramble";
import { ScrambleMotion } from "@/theme";

/** Plays a decode effect over `text` on demand; `letters` is null while idle. */
export function useScrambleText(text: string, duration: number = ScrambleMotion.duration) {
  const reduced = useReducedMotion();
  const [letters, setLetters] = useState<ScrambleLetter[] | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const play = useCallback(() => {
    if (reduced) return;
    stop();
    const start = Date.now();
    setLetters(scrambleFrame(text, 0, ScrambleMotion.hold));
    timer.current = setInterval(() => {
      const progress = Math.min(1, (Date.now() - start) / duration);
      if (progress >= 1) {
        stop();
        setLetters(null);
        return;
      }
      setLetters(scrambleFrame(text, progress, ScrambleMotion.hold));
    }, ScrambleMotion.frame);
  }, [duration, reduced, stop, text]);

  return { letters, playing: letters !== null, play };
}
