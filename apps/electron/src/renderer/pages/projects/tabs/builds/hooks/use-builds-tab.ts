import type { BuildJob, BuildProfile, BuildTarget, Project } from "@theone/protocol";
import { useCallback, useMemo, useState } from "react";
import { useConnectionClient, useWindowVisible } from "../../../../../app/connection";
import type { LogPanelAction } from "../../../../../components/LogPanel";
import { showToast } from "../../../../../components/Toast";
import { FIX_LOG_TAIL } from "../../../../../features/projects/constants";
import { useLogFollower } from "../../../../../features/projects/hooks/use-log-follower";
import type { TabHost } from "../../../../../features/projects/hooks/use-tab-host";
import { FIX_LABELS } from "../../../../../features/projects/labels";
import { buildFailurePrompt, canFixBuild, projectBuilds, targetLabel } from "../../../../../features/projects/model";
import { KIT_LABELS, useConfirm, useFixWithAi, usePendingSet } from "../../kit";
import { DEFAULT_BUILD_PROFILE } from "../constants";
import { BUILDS_LABELS as L } from "../labels";
import { cancelBody, PROFILE_OPTIONS } from "../model";

export interface BuildsTabInput {
  project: Project;
  builds: readonly BuildJob[] | null;
  host: TabHost;
}

export function useBuildsTab({ project, builds: list, host }: BuildsTabInput) {
  const { upsert, report } = host;
  const client = useConnectionClient();
  const windowVisible = useWindowVisible();
  const upsertBuild = useCallback((build: BuildJob) => upsert("build", build), [upsert]);
  const follower = useLogFollower({ visible: host.visible && windowVisible, onUpdate: (item) => upsertBuild(item as BuildJob) });
  const fixer = useFixWithAi(host);
  const confirm = useConfirm();
  const starting = usePendingSet();
  const cancelling = usePendingSet();
  const [profile, setProfile] = useState<BuildProfile>(DEFAULT_BUILD_PROFILE);

  const builds = useMemo(() => (list ? projectBuilds(list) : null), [list]);
  const shownId = follower.target?.kind === "build" ? follower.target.id : null;
  const shown = useMemo(() => builds?.find((build) => build.id === shownId) ?? null, [builds, shownId]);

  const openLogs = useCallback((build: BuildJob) => follower.follow("build", build.id), [follower]);

  const toggleLogs = useCallback(
    (build: BuildJob) => (shownId === build.id ? follower.stop() : openLogs(build)),
    [shownId, follower, openLogs],
  );

  const fix = useCallback(
    (build: BuildJob) => {
      if (!client) return;
      fixer.fix(
        build.id,
        () => client.buildLogs(build.id, { tail: FIX_LOG_TAIL }),
        (lines) => buildFailurePrompt(build, lines),
      );
    },
    [client, fixer],
  );

  const start = useCallback(
    async (target: BuildTarget) => {
      if (starting.has(target)) return;
      if (!client) {
        report(new Error(KIT_LABELS.notConnected));
        return;
      }
      starting.set(target, true);
      try {
        const build = await client.startBuild({ projectId: project.id, target, profile });
        upsertBuild(build);
        showToast(L.started(targetLabel(target)));
        openLogs(build);
      } catch (error) {
        report(error);
      } finally {
        starting.set(target, false);
      }
    },
    [client, starting, project.id, profile, upsertBuild, openLogs, report],
  );

  const cancel = useCallback(
    async (build: BuildJob) => {
      if (!client || cancelling.has(build.id)) return;
      cancelling.set(build.id, true);
      try {
        upsertBuild(await client.cancelBuild(build.id));
      } catch (error) {
        report(error);
      } finally {
        cancelling.set(build.id, false);
      }
    },
    [client, cancelling, upsertBuild, report],
  );

  const askCancel = useCallback(
    (build: BuildJob) =>
      confirm.ask({
        heading: L.cancelTitle,
        body: cancelBody(build),
        confirmLabel: L.cancelConfirm,
        cancelLabel: L.keep,
        onConfirm: () => void cancel(build),
      }),
    [confirm, cancel],
  );

  const panelAction: LogPanelAction | null =
    shown && canFixBuild(shown)
      ? { label: FIX_LABELS.action, icon: "fix-ai", onClick: () => fix(shown), sensitive: !fixer.isPending(shown.id) }
      : null;

  return {
    targets: project.buildTargets,
    builds,
    profile,
    profileOptions: PROFILE_OPTIONS,
    setProfile,
    follower,
    shownId,
    panelTitle: shown ? L.logsTitle(targetLabel(shown.target)) : null,
    panelAction,
    confirm,
    start,
    isStarting: (target: string) => starting.pending.has(target),
    toggleLogs,
    closeLogs: follower.stop,
    fix,
    isFixPending: fixer.isPending,
    askCancel,
    isCancelling: (id: string) => cancelling.pending.has(id),
  };
}
