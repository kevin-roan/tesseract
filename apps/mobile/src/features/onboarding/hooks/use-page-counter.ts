import { useState } from "react";
import { useAnimatedReaction, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { formatPage } from "../utils/content";

export function usePageCounter(progress: SharedValue<number>, count: number) {
  const [page, setPage] = useState(0);

  useAnimatedReaction(
    () => Math.round(progress.value),
    (current, previous) => {
      if (current !== previous) scheduleOnRN(setPage, current);
    },
  );

  return formatPage(Math.min(Math.max(page, 0), count - 1) + 1, count);
}
