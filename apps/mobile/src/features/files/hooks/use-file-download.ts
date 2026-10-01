import { Linking } from "react-native";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { TheOneClient } from "@theone/client";
import type { Artifact } from "@theone/protocol";

import { sandboxKeys } from "@/features/sandbox/api/query-keys";
import { useSandboxClient } from "@/features/sandbox/hooks/use-sandbox-client";

import { describeFileError, MissingFileError } from "../utils/errors";

async function fileExists(queryClient: QueryClient, client: TheOneClient, sandboxId: string, id: string): Promise<boolean> {
  const queryKey = sandboxKeys.artifacts(sandboxId);
  if (queryClient.getQueryData<Artifact[]>(queryKey)?.some((artifact) => artifact.id === id)) return true;
  const artifacts = await queryClient.fetchQuery({
    queryKey,
    queryFn: ({ signal }) => client.listArtifacts(undefined, { signal }),
    staleTime: 0,
  });
  return artifacts.some((artifact) => artifact.id === id);
}

export function useFileDownload() {
  const { sandbox, client } = useSandboxClient();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (artifactId: string) => {
      if (!client || !sandbox) throw new Error("No sandbox is paired.");
      if (!(await fileExists(queryClient, client, sandbox.id, artifactId))) throw new MissingFileError();
      await Linking.openURL(await client.artifactDownloadUrl(artifactId));
    },
  });

  return {
    download: mutation.mutate,
    pendingId: mutation.isPending ? mutation.variables : null,
    error: mutation.error ? describeFileError(mutation.error) : null,
    reset: mutation.reset,
  };
}
