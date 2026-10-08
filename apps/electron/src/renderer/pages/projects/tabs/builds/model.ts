import { isFinalBuildState, type BuildJob, type BuildProfile, type BuildTarget } from "@tesseract/protocol";
import type { ChipOption } from "../../../../components/Chip";
import type { RecordStatus } from "../../../../components/RecordRow";
import { BUILD_TARGET_LABELS } from "../../../../features/projects/labels";
import { elapsedSeconds, formatDuration, formatRelativeTime, joinMeta } from "../../../../features/projects/format";
import { profileLabel, targetLabel } from "../../../../features/projects/model";
import { BUILD_PROFILE_ORDER, BUILD_TONES } from "./constants";
import { BUILDS_LABELS as L } from "./labels";

export function targetSubtitle(target: BuildTarget | string): string | null {
  const platform = BUILD_TARGET_LABELS[target as BuildTarget]?.[1];
  return platform ? L.subtitle(platform, target) : null;
}

export const PROFILE_OPTIONS: readonly ChipOption<BuildProfile>[] = BUILD_PROFILE_ORDER.map((id) => ({ id, label: profileLabel(id) }));

export function isFinalBuild(build: Pick<BuildJob, "state">): boolean {
  return isFinalBuildState(build.state);
}

export function buildStatus(build: Pick<BuildJob, "state">): RecordStatus {
  return { label: L.states[build.state] ?? build.state, tone: BUILD_TONES[build.state] ?? "neutral", glyph: true };
}

export function buildProgress(build: Pick<BuildJob, "state" | "progress">): number | null | undefined {
  if (isFinalBuild(build)) return undefined;
  return typeof build.progress === "number" ? build.progress : null;
}

export function buildMeta(build: BuildJob, now = Date.now()): string {
  const parts: string[] = [L.meta(profileLabel(build.profile), formatRelativeTime(build.startedAt || build.createdAt, now))];
  if (build.stage && !isFinalBuild(build)) parts.push(build.stage);
  if (isFinalBuild(build) && build.startedAt) {
    const seconds = elapsedSeconds(build.startedAt, build.endedAt, now);
    if (seconds !== null) parts.push(formatDuration(seconds));
  }
  if (build.artifacts.length > 0) parts.push(L.artifacts(build.artifacts.length));
  return joinMeta(...parts);
}

export function cancelBody(build: Pick<BuildJob, "target" | "profile">): string {
  return L.cancelBody(targetLabel(build.target), profileLabel(build.profile));
}
