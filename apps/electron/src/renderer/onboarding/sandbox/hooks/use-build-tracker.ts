import { useEffect, useRef, useState } from "react";
import type { BuildPhase } from "../../../../shared/contracts/sandbox";
import { showToast } from "../../../components/Toast";
import { ONBOARDING_TOAST_SCOPE } from "../../shell";
import { SANDBOX_STEP_LABELS } from "../labels";
import { advanceTrack, EMPTY_TRACK, isRunningKind, type BuildTrack } from "../model";

export function useBuildTracker(phase: BuildPhase): BuildTrack {
  const [track, setTrack] = useState<BuildTrack>(EMPTY_TRACK);
  const previous = useRef(phase.kind);

  useEffect(() => {
    setTrack((current) => advanceTrack(current, phase, Date.now()));
    const was = previous.current;
    previous.current = phase.kind;
    if (was !== phase.kind && isRunningKind(was) && phase.kind === "cancelled") {
      showToast(SANDBOX_STEP_LABELS.build.cancelledToast, {
        scope: ONBOARDING_TOAST_SCOPE,
      });
    }
  }, [phase]);

  return track;
}
