import { Linking } from "react-native";
import { useMutation } from "@tanstack/react-query";

import { describeError } from "../utils/errors";
import { useSandboxClient } from "./use-sandbox-client";

export function useArtifactDownload() {
  const { client } = useSandboxClient();
  const mutation = useMutation({
    mutationFn: async (artifactId: string) => {
      if (!client) throw new Error("No sandbox is paired.");
      await Linking.openURL(await client.artifactDownloadUrl(artifactId));
    },
  });

  return {
    download: (artifactId: string) => mutation.mutate(artifactId),
    pendingId: mutation.isPending ? mutation.variables : null,
    error: mutation.error ? describeError(mutation.error) : null,
  };
}
