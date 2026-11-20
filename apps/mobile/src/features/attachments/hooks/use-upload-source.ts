import { useMemo } from "react";
import { restPaths } from "@tesseract/protocol";

import { useSandboxClient } from "@/features/sandbox/hooks/use-sandbox-client";
import { useResolvedUrl } from "@/features/tailnet";

export type UploadSource = { uri: string; headers: Record<string, string> };

export function useUploadSource(uploadId: string, enabled = true): UploadSource | null {
  const { client } = useSandboxClient();
  const uri = useResolvedUrl(enabled && client ? client.httpUrl(restPaths.uploadContent(uploadId)) : null);
  return useMemo(() => (uri && client ? { uri, headers: client.authHeaders() } : null), [client, uri]);
}
