import { useCallback, useMemo, useRef, useState } from "react";
import { Linking } from "react-native";

import type { HeaderAction } from "@/components/screen-header";
import type { WebSurfaceHandle } from "@/components/web-surface/types";
import { useActiveSandbox } from "@/features/sandbox/hooks/use-sandbox-client";
import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { originOf } from "@/lib/url";

import { PREVIEW_ACTIONS, PREVIEW_COPY } from "../utils/content";
import { previewUrlOf } from "../utils/runs";
import { useAppRun } from "./use-app-run-queries";

export function usePreviewScreen(runId: string | undefined, sandboxId: string | undefined, title: string | undefined) {
  const nav = useSandboxNavigation();
  const sandbox = useActiveSandbox();
  const surfaceRef = useRef<WebSurfaceHandle>(null);
  const matches = runId !== undefined && (sandboxId === undefined || sandbox?.id === sandboxId);
  const run = useAppRun(matches ? runId : "");
  const url = run.data ? previewUrlOf(run.data) : null;
  const origin = url ? originOf(url) : null;
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setGeneration((value) => value + 1);
  }, []);

  const reload = useCallback(() => {
    if (error) return retry();
    surfaceRef.current?.reload();
  }, [error, retry]);

  const headerActions = useMemo<HeaderAction[]>(
    () =>
      url && origin
        ? [
            { ...PREVIEW_ACTIONS.reload, onPress: reload },
            { ...PREVIEW_ACTIONS.browser, onPress: () => void Linking.openURL(url).catch(() => undefined) },
          ]
        : [],
    [url, origin, reload],
  );

  return {
    nav,
    loading: matches && run.isLoading,
    url: url && origin ? url : null,
    origin,
    title: title || PREVIEW_COPY.title,
    subtitle: url ?? undefined,
    surfaceRef,
    surfaceKey: generation,
    error,
    onError: setError,
    onLoad: () => setError(null),
    retry,
    headerActions,
  };
}
