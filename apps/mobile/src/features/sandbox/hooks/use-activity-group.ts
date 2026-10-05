import { useCallback, useState } from "react";

import { useNow } from "@/hooks/use-now";
import { activityLine, formatTimer, type TranscriptActivity } from "@/features/chat/utils/transcript";

import { elapsedSeconds, formatDuration } from "../utils/format";

/** Live timer, folded state and title of one activity block in a run transcript. */
export function useActivityGroup(activity: TranscriptActivity) {
  const active = activity.endedAt === null;
  const [expanded, setExpanded] = useState(false);
  const now = useNow(active);
  const seconds = elapsedSeconds(activity.startedAt, activity.endedAt, now) ?? 0;
  const steps = activity.events.length;
  const toggle = useCallback(() => setExpanded((open) => !open), []);

  return {
    active,
    expanded,
    toggle: steps > 0 ? toggle : undefined,
    title: active ? "Working" : seconds >= 1 ? "Worked for" : steps === 1 ? "1 step" : `${steps} steps`,
    value: active ? formatTimer(seconds) : seconds >= 1 ? formatDuration(seconds) : null,
    line: active ? (activityLine(activity.events) ?? "Getting ready…") : null,
  };
}
