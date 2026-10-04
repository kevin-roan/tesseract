import {
  isFinalBuildState,
  type AgentRun,
  type Artifact,
  type BuildJob,
  type ProcessInfo,
  type SandboxStatus,
  type StatusEvent,
  type TerminalInfo,
} from "@theone/protocol";

import { buildProfileLabel } from "./labels";
import { capitalize, elapsedSeconds, formatBytes, formatDuration, formatRelativeTime, formatUptime, formatUsageTokens } from "./format";

const join = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");

export function processMeta(process: ProcessInfo, now: number = Date.now()): string {
  return join([
    process.port ? `port ${process.port}` : null,
    process.display ? "on display" : null,
    process.exitCode !== null ? `exit ${process.exitCode}` : null,
    `started ${formatRelativeTime(process.startedAt, now)}`,
  ]);
}

export function terminalMeta(terminal: TerminalInfo, now: number = Date.now()): string {
  return join([terminal.projectId, `${terminal.cols}×${terminal.rows}`, `opened ${formatRelativeTime(terminal.createdAt, now)}`]);
}

export function buildMeta(build: BuildJob, now: number = Date.now()): string {
  const seconds = elapsedSeconds(build.startedAt, build.endedAt, now);
  return join([
    build.stage && !isFinalBuildState(build.state) ? capitalize(build.stage) : null,
    seconds !== null ? formatDuration(seconds) : null,
    formatRelativeTime(build.createdAt, now),
  ]);
}

export function buildSubtitle(build: BuildJob): string {
  return join([build.projectId, buildProfileLabel(build.profile)]);
}

export function agentRunMeta(run: AgentRun, now: number = Date.now()): string {
  return join([run.projectId ?? "No project", formatRelativeTime(run.startedAt, now), formatUsageTokens(run.usage)]);
}

export function artifactSubtitle(artifact: Artifact): string {
  return join([capitalize(artifact.platform), formatBytes(artifact.sizeBytes)]);
}

export function artifactMeta(artifact: Artifact, now: number = Date.now()): string {
  return join([`sha256 ${artifact.sha256.slice(0, 12)}`, formatRelativeTime(artifact.createdAt, now)]);
}

export function sandboxSubtitle(status: SandboxStatus | undefined): string | undefined {
  if (!status) return undefined;
  return join([`v${status.version}`, `up ${formatUptime(status.uptimeSec)}`]);
}

export function activityTitle(event: StatusEvent): string {
  return join([event.project ?? "Sandbox", capitalize(event.status), event.platform, event.stage]);
}
