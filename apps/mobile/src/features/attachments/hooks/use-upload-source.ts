import { useMemo } from "react";
import { restPaths } from "@theone/protocol";

import { useSandboxClient } from "@/features/sandbox/hooks/use-sandbox-client";

export type UploadSource = { uri: string; headers: Record<string, string> };

export function useUploadSource(uploadId: string, enabled = true): UploadSource | null {
  const { client } = useSandboxClient();
  return useMemo(
    () => (enabled && client ? { uri: client.httpUrl(restPaths.uploadContent(uploadId)), headers: client.authHeaders() } : null),
    [client, uploadId, enabled],
  );
}
