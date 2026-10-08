import type { Artifact, BuildOutput } from "@tesseract/protocol";

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
