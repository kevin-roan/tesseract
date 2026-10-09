import type { Artifact, BuildOutput, ProjectFile } from "@tesseract/protocol";

import type { LocalDownload } from "../hooks/use-local-downloads";
import { buildOutputKey } from "./build-outputs";

const safeSegment = (value: string): string => value.replace(/[^\w.-]+/g, "_") || "_";

export const artifactDownload = (artifact: Artifact, sandboxId: string | null, resolveUrl: () => Promise<string>): LocalDownload => ({
  key: artifact.id,
  ref: {
    folder: ["artifacts", safeSegment(sandboxId ?? "local"), safeSegment(artifact.id)],
    fileName: artifact.fileName,
    sizeBytes: artifact.sizeBytes,
  },
  resolveUrl,
});

export const buildOutputDownload = (output: BuildOutput, sandboxId: string | null, resolveUrl: () => Promise<string>): LocalDownload => ({
  key: buildOutputKey(output),
  ref: {
    folder: ["builds", safeSegment(sandboxId ?? "local"), safeSegment(buildOutputKey(output)), String(Date.parse(output.modifiedAt))],
    fileName: output.fileName,
    sizeBytes: output.sizeBytes,
  },
  resolveUrl,
});

export const projectFileDownload = (
  projectId: string,
  file: ProjectFile,
  sandboxId: string | null,
  resolveUrl: () => Promise<string>,
): LocalDownload => ({
  key: `${projectId}/${file.path}`,
  ref: {
    folder: [
      "projects",
      safeSegment(sandboxId ?? "local"),
      safeSegment(projectId),
      ...file.path.split("/").slice(0, -1).map(safeSegment),
      String(file.modifiedAt ? Date.parse(file.modifiedAt) : 0),
    ],
    fileName: file.name,
    sizeBytes: file.sizeBytes ?? 0,
  },
  resolveUrl,
});
