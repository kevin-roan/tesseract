import { useEffect } from "react";
import { router } from "expo-router";

import { actionFromRoute } from "../utils/actions";
import { useIslandDispatch } from "./use-island-dispatch";

/** Deep links land on a blank route; leave it first so the action opens over the previous screen. */
export function useIslandRoute(action: string | undefined, runId?: string | undefined): void {
  const { dispatch } = useIslandDispatch();

  useEffect(() => {
    const parsed = actionFromRoute(action, runId);
    if (router.canGoBack()) router.back();
    else router.replace("/");
    if (parsed) void dispatch(parsed);
    // Runs once per deep link; the params identify the link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, runId]);
}
