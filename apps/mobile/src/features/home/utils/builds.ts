import { isFinalBuildState, type BuildJob } from "@theone/protocol";

import { buildTargetLabel } from "@/features/sandbox/utils/labels";
import { capitalize, elapsedSeconds, formatDuration, pluralize } from "@/features/sandbox/utils/format";

export function activeBuilds(builds: readonly BuildJob[]): BuildJob[] {
  return builds
    .filter((build) => !isFinalBuildState(build.state))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function buildActivityTitle(build: BuildJob): string {
  const label = buildTargetLabel(build.target);
  return build.state === "queued" ? `${label} queued` : `Building ${label}`;
}

export function buildActivityMessage(build: BuildJob, others: number, now: number = Date.now()): string {
  const seconds = elapsedSeconds(build.startedAt, build.endedAt, now);
  return [
    build.projectId,
    build.stage ? capitalize(build.stage) : null,
    seconds !== null ? formatDuration(seconds) : null,
    others > 0 ? `+${pluralize(others, "more build", "more builds")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
