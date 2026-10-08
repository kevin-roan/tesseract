import { useCallback } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { TesseractClient } from "@tesseract/client";
import type { Artifact, BuildOutput } from "@tesseract/protocol";

import { sandboxKeys } from "@/features/sandbox/api/query-keys";
import { useSandboxClient } from "@/features/sandbox/hooks/use-sandbox-client";

import { artifactDownload, buildOutputDownload } from "../utils/local-downloads";
import { MissingFileError } from "../utils/errors";
import { useLocalDownloads, type LocalDownload } from "./use-local-downloads";

async function fileExists(queryClient: QueryClient, client: TesseractClient, sandboxId: string, id: string): Promise<boolean> {
  const queryKey = sandboxKeys.artifacts(sandboxId);
  if (queryClient.getQueryData<Artifact[]>(queryKey)?.some((artifact) => artifact.id === id)) return true;
  const artifacts = await queryClient.fetchQuery({
    queryKey,
    queryFn: ({ signal }) => client.listArtifacts(undefined, { signal }),
    staleTime: 0,
  });
  return artifacts.some((artifact) => artifact.id === id);
}

function usePairedClient() {
  const { sandbox, client } = useSandboxClient();
  const paired = useCallback(() => {
    if (!client || !sandbox) throw new Error("No sandbox is paired.");
    return { client, sandbox };
  }, [client, sandbox]);
  return { sandboxId: sandbox?.id ?? null, paired };
}

function bindDownloads<T>(local: ReturnType<typeof useLocalDownloads>, toItem: (value: T) => LocalDownload) {
  return {
    download: (value: T) => local.download(toItem(value)),
    share: (value: T) => local.share(toItem(value)),
    status: (value: T) => local.status(toItem(value)),
    error: local.error,
    showError: local.showError,
  };
}

export function useFileDownload() {
  const { sandboxId, paired } = usePairedClient();
  const queryClient = useQueryClient();
  const local = useLocalDownloads();
  const toItem = useCallback(
    (artifact: Artifact): LocalDownload =>
      artifactDownload(artifact, sandboxId, async () => {
        const { client, sandbox } = paired();
        if (!(await fileExists(queryClient, client, sandbox.id, artifact.id))) throw new MissingFileError();
        return client.artifactDownloadUrl(artifact.id);
      }),
    [sandboxId, paired, queryClient],
  );
  return bindDownloads(local, toItem);
}

export function useBuildOutputDownload() {
  const { sandboxId, paired } = usePairedClient();
  const local = useLocalDownloads();
  const toItem = useCallback(
    (output: BuildOutput): LocalDownload => buildOutputDownload(output, sandboxId, () => paired().client.buildOutputDownloadUrl(output)),
    [sandboxId, paired],
  );
  return bindDownloads(local, toItem);
}
