import { useEffect, useState } from "react";

import { useSandboxLink } from "@/features/sandbox/hooks/use-sandbox-events";

import { UNREACHABLE_GRACE_MS } from "../utils/status";

/** True once the events socket has been down for a moment, so a launch or a quick reconnect does not flash the banner. */
export function useSandboxUnreachable(): boolean {
  const link = useSandboxLink();
  const down = link === "connecting" || link === "closed";
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    if (!down) return;
    const timer = setTimeout(() => setUnreachable(true), UNREACHABLE_GRACE_MS);
    // Reset when the link comes back, so the next outage waits out the grace period again.
    return () => {
      clearTimeout(timer);
      setUnreachable(false);
    };
  }, [down]);

  return down && unreachable;
}
