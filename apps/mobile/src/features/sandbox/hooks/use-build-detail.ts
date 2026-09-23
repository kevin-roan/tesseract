import { useCallback, useMemo } from "react";
import { isFinalBuildState } from "@theone/protocol";

import type { HeaderAction } from "@/components/screen-header";
import { confirm } from "@/lib/confirm";

import { PAGE_ACTIONS } from "../utils/actions";
import { buildMeta, buildSubtitle } from "../utils/describe";
import { describeError } from "../utils/errors";
import { buildTargetLabel } from "../utils/labels";
import { buildTone, stateLabel } from "../utils/states";
import { useArtifactDownload } from "./use-artifact-download";
import { useLogStream } from "./use-log-stream";
import { useCancelBuild } from "./use-sandbox-mutations";
import { useSandboxNavigation } from "./use-sandbox-navigation";
import { useBuild } from "./use-sandbox-queries";

export function useBuildDetail(buildId: string) {
  const nav = useSandboxNavigation();
  const build = useBuild(buildId);
  const logs = useLogStream({ kind: "build", id: buildId });
  const cancelBuild = useCancelBuild();
  const downloads = useArtifactDownload();
  const data = build.data;
  const active = data ? !isFinalBuildState(data.state) : false;
  const { mutate } = cancelBuild;

  const cancel = useCallback(async () => {
    const confirmed = await confirm({
      title: "Cancel this build?",
      message: "The build process is stopped and no artifacts are collected.",
      confirmLabel: "Cancel build",
      cancelLabel: "Keep building",
      destructive: true,
    });
    if (confirmed) mutate(buildId);
  }, [buildId, mutate]);

  const headerActions = useMemo<HeaderAction[]>(
    () =>
      active
        ? [{ ...PAGE_ACTIONS.cancel, label: "Cancel build", onPress: () => void cancel(), disabled: cancelBuild.isPending }]
        : [{ ...PAGE_ACTIONS.reconnect, label: "Reload logs", onPress: logs.reconnect }],
    [active, cancel, cancelBuild.isPending, logs.reconnect],
  );

  return {
    nav,
    build: data,
    title: data ? buildTargetLabel(data.target) : "Build",
    subtitle: data ? buildSubtitle(data) : undefined,
    meta: data ? buildMeta(data) : undefined,
    badge: data ? { label: stateLabel(data.state), tone: buildTone(data.state) } : undefined,
    active,
    isLoading: build.isLoading,
    error: build.error ? describeError(build.error) : null,
    retry: () => void build.refetch(),
    logs,
    headerActions,
    cancelError: cancelBuild.error ? describeError(cancelBuild.error) : null,
    downloads,
  };
}
