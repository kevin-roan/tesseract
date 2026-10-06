import { RUN_TARGET_VIEWERS, isFinalAppRunState, type AppRun, type AppViewer, type AppViewerKind, type RunTarget, type RunTargetInfo } from "@theone/protocol";

import { newestFirst } from "@/features/sandbox/utils/collections";
import { formatRelativeTime } from "@/features/sandbox/utils/format";

type DeeplinkViewer = Extract<AppViewer, { kind: "deeplink" }>;

export type AppRunOpen =
  | { kind: "preview"; url: string }
  | { kind: "deeplink"; url: string; manifestUrl: string }
  | { kind: "display"; focus: boolean }
  | { kind: "android" };

export type AppRunEntry = {
  target: RunTarget;
  label: string;
  viewer: AppViewerKind;
  info: RunTargetInfo | null;
  run: AppRun | null;
};

export const isActiveAppRun = (run: AppRun): boolean => !isFinalAppRunState(run.state);

export const viewerKindOf = (run: AppRun): AppViewerKind => run.viewer?.kind ?? RUN_TARGET_VIEWERS[run.target];

export const deepLinkFor = (viewer: DeeplinkViewer): string => viewer.devClientUrl ?? viewer.expoGoUrl;

/** How the phone opens a run: web and Expo runs once ready, the display and the emulator while the run is alive. */
export function openPlanFor(run: AppRun): AppRunOpen | null {
  if (!isActiveAppRun(run)) return null;
  const ready = run.state === "ready";
  switch (viewerKindOf(run)) {
    case "display":
      return { kind: "display", focus: ready && run.actions.includes("focus") };
    case "android":
      return { kind: "android" };
    case "url":
      return ready && run.viewer?.kind === "url" && run.viewer.url ? { kind: "preview", url: run.viewer.url } : null;
    case "deeplink":
      return ready && run.viewer?.kind === "deeplink"
        ? { kind: "deeplink", url: deepLinkFor(run.viewer), manifestUrl: run.viewer.manifestUrl }
        : null;
    case "none":
      return null;
  }
}

export const previewUrlOf = (run: AppRun): string | null => {
  const plan = openPlanFor(run);
  return plan?.kind === "preview" ? plan.url : null;
};

export const isUnreachable = (run: AppRun): boolean =>
  run.state === "ready" && run.viewer?.kind === "url" && run.viewer.url === null;

/** Actions the controller accepts right now: only on a ready run, and focus is what Open already does. */
export const runActions = (run: AppRun) => (run.state === "ready" ? run.actions : []);

/** One entry per offered target with its newest run; runs of targets no longer offered follow. */
export function appRunEntries(targets: readonly RunTargetInfo[], runs: readonly AppRun[]): AppRunEntry[] {
  const latest = new Map<RunTarget, AppRun>();
  for (const run of newestFirst(runs, (entry) => entry.startedAt)) if (!latest.has(run.target)) latest.set(run.target, run);
  const offered = targets.map((info) => ({
    target: info.target,
    label: info.label,
    viewer: info.viewer,
    info,
    run: latest.get(info.target) ?? null,
  }));
  const known = new Set(targets.map((info) => info.target));
  const orphans = [...latest.values()]
    .filter((run) => !known.has(run.target))
    .map((run) => ({ target: run.target, label: run.target, viewer: viewerKindOf(run), info: null, run }));
  return [...offered, ...orphans];
}

export function appRunMeta(run: AppRun, now: number = Date.now()): string {
  return [
    run.port ? `port ${run.port}` : null,
    run.readyAt ? `ready ${formatRelativeTime(run.readyAt, now)}` : `started ${formatRelativeTime(run.startedAt, now)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export const canStart = (entry: AppRunEntry): boolean =>
  entry.info?.available === true && (entry.run === null || !isActiveAppRun(entry.run));

export type EmulatorAction =
  | { kind: "show"; entry: AppRunEntry; run: AppRun }
  | { kind: "start"; entry: AppRunEntry }
  | { kind: "setup"; entry: AppRunEntry; reason: string | null };

export type EmulatorDestination = "android" | "host";

/** How an Android project opens its app: the live run's emulator, a new run, or the host emulator controls while no target can start. */
export function emulatorActionFor(entries: readonly AppRunEntry[]): EmulatorAction | null {
  const android = entries.filter((entry) => entry.viewer === "android");
  const live = android.find((entry) => entry.run !== null && isActiveAppRun(entry.run));
  if (live?.run) return { kind: "show", entry: live, run: live.run };
  const offered = android.filter((entry) => entry.info !== null);
  const startable = offered.find(canStart);
  if (startable) return { kind: "start", entry: startable };
  const first = offered[0];
  return first ? { kind: "setup", entry: first, reason: first.info?.reason ?? null } : null;
}

/** The emulator screen once a run exists or is started, the host screen (pair, unlock, start, link) otherwise. */
export const emulatorDestination = (action: EmulatorAction): EmulatorDestination =>
  action.kind === "setup" ? "host" : "android";
