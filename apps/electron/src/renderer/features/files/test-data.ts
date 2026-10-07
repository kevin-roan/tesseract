import type { Artifact, BuildOutput } from "@theone/protocol";

export const NOW = Date.parse("2026-09-28T12:00:00Z") / 1000;

export function artifact(id: string, projectId = "app", createdAt = "2026-09-28T11:00:00Z", extra: Partial<Artifact> = {}): Artifact {
  return {
    id,
    projectId,
    buildId: null,
    fileName: `${id}.apk`,
    path: `/workspace/artifacts/${id}.apk`,
    sizeBytes: 3 * 1024 * 1024,
    sha256: "f".repeat(64),
    platform: "android",
    source: "build",
    agentRunId: null,
    note: null,
    createdAt,
    ...extra,
  };
}

export function output(path: string, projectId = "app", modifiedAt = "2026-09-28T11:00:00Z", platform = "android"): BuildOutput {
  return { projectId, path, fileName: path.split("/").pop() ?? path, sizeBytes: 2048, platform, modifiedAt };
}
