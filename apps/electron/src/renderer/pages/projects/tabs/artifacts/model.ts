import type { Artifact } from "@theone/protocol";

export type ArtifactsView = "loading" | "empty" | "content";

export function artifactsView(artifacts: readonly Artifact[] | null): ArtifactsView {
  if (artifacts === null) return "loading";
  return artifacts.length === 0 ? "empty" : "content";
}
