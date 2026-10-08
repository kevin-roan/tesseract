import type {
  AgentRun,
  BuildJob,
  Identity,
  ProcessInfo,
  Project,
  SandboxStatus,
  TailscaleUser,
} from "@tesseract/protocol";

import type { ProfileStat } from "@/components/profile-hero";
import { formatTokens } from "@/features/home/utils/tokens";

import type { ActivityActor, ActivityEntry, PairedSandbox, ProfileView } from "../types";
import { ACTIVITY_FEED_LIMIT } from "./constants";
import { elapsedSeconds, formatDuration, formatRelativeTime } from "./format";
import { agentRunActivityAction, buildActivityAction, processActivityAction } from "./labels";
import { stateLabel } from "./states";

const EMPTY_VALUE = "—";
const WHOLE_SANDBOX = "the sandbox";

const join = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

const trimDot = (name: string | null | undefined) => (name ? name.replace(/\.$/, "") : null);

const toTime = (iso: string | null) => {
  const value = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(value) ? 0 : value;
};

export function profilePerson(identity: Identity | undefined): TailscaleUser | null {
  return identity?.tailscale.viewer ?? identity?.tailscale.owner ?? null;
}

export function isTailscaleIdentityMissing(identity: Identity | undefined): boolean {
  return identity !== undefined && (!identity.tailscale.available || profilePerson(identity) === null);
}

export function profileView(
  identity: Identity | undefined,
  sandbox: PairedSandbox,
  status?: SandboxStatus,
): ProfileView {
  const tailscale = identity?.tailscale;
  const person = profilePerson(identity);
  const node = tailscale?.node ?? null;
  const host = trimDot(node?.dnsName) ?? node?.hostName ?? status?.hostname ?? null;
  return {
    name: person?.displayName || sandbox.name,
    tagline: join([person?.loginName, host]) || sandbox.baseUrl,
    team: tailscale?.tailnet ?? undefined,
    photo: person?.profilePicUrl ?? undefined,
  };
}

export function activityActor(identity: Identity | undefined, sandbox: PairedSandbox): ActivityActor {
  const person = profilePerson(identity);
  return { name: person?.displayName || sandbox.name, photo: person?.profilePicUrl ?? undefined };
}

export function profileStats(status: SandboxStatus | undefined): ProfileStat[] {
  const count = (value: number | undefined) => (value === undefined ? EMPTY_VALUE : String(value));
  const counts = status?.counts;
  return [
    { id: "projects", value: count(counts?.projects), label: "Projects" },
    { id: "running", value: count(counts?.runningProcesses), label: "Running" },
    { id: "builds", value: count(counts?.activeBuilds), label: "Builds" },
  ];
}

export type ActivitySources = {
  builds?: readonly BuildJob[];
  runs?: readonly AgentRun[];
  processes?: readonly ProcessInfo[];
  projects?: readonly Project[];
};

export function activityFeed(
  { builds = [], runs = [], processes = [], projects = [] }: ActivitySources,
  actor: ActivityActor,
  now: number = Date.now(),
  limit: number = ACTIVITY_FEED_LIMIT,
): ActivityEntry[] {
  const names = new Map(projects.map((project) => [project.id, project.name]));
  const projectName = (id: string | null) => (id ? (names.get(id) ?? id) : WHOLE_SANDBOX);
  const timeAgo = (iso: string) => formatRelativeTime(iso, now);

  const entries: ActivityEntry[] = [
    ...builds.map((build): ActivityEntry => {
      const at = build.endedAt ?? build.startedAt ?? build.createdAt;
      return {
        id: `build-${build.id}`,
        ref: { kind: "build", id: build.id },
        time: toTime(at),
        item: {
          actor: actor.name,
          photo: actor.photo,
          action: buildActivityAction(build),
          target: projectName(build.projectId),
          timeAgo: timeAgo(at),
          metrics: [
            { id: "state", value: stateLabel(build.state), label: "State" },
            {
              id: "progress",
              value: build.progress === null ? EMPTY_VALUE : `${Math.round(build.progress * 100)}%`,
              label: "Progress",
            },
            { id: "artifacts", value: String(build.artifacts.length), label: "Artifacts" },
          ],
        },
      };
    }),
    ...runs.map((run): ActivityEntry => {
      const at = run.endedAt ?? run.startedAt;
      const seconds = elapsedSeconds(run.startedAt, run.endedAt, now);
      return {
        id: `run-${run.id}`,
        ref: { kind: "run", id: run.id },
        time: toTime(at),
        item: {
          actor: actor.name,
          photo: actor.photo,
          action: agentRunActivityAction(run.state),
          target: projectName(run.projectId),
          timeAgo: timeAgo(at),
          metrics: [
            { id: "state", value: stateLabel(run.state), label: "State" },
            { id: "tokens", value: run.usage ? formatTokens(run.usage.totalTokens) : EMPTY_VALUE, label: "Tokens" },
            { id: "duration", value: seconds === null ? EMPTY_VALUE : formatDuration(seconds), label: "Duration" },
          ],
        },
      };
    }),
    ...processes.map((process): ActivityEntry => {
      const at = process.endedAt ?? process.startedAt;
      return {
        id: `process-${process.id}`,
        ref: { kind: "process", id: process.id, projectId: process.projectId },
        time: toTime(at),
        item: {
          actor: actor.name,
          photo: actor.photo,
          action: processActivityAction(process.state),
          target: process.projectId ? `${process.name} in ${projectName(process.projectId)}` : process.name,
          timeAgo: timeAgo(at),
          metrics: [
            { id: "state", value: stateLabel(process.state), label: "State" },
            { id: "port", value: process.port === null ? EMPTY_VALUE : String(process.port), label: "Port" },
            { id: "pid", value: String(process.pid), label: "PID" },
          ],
        },
      };
    }),
  ];

  return entries.sort((a, b) => b.time - a.time).slice(0, limit);
}
