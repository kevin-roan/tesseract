import { useQueryClient } from "@tanstack/react-query";
import type { Issue } from "@tesseract/protocol";

import { useSandboxClient } from "@/features/sandbox/hooks/use-sandbox-client";
import { useSandboxQuery } from "@/features/sandbox/hooks/use-sandbox-query";

import { cachedIssue } from "../api/cache";
import { issueKeys } from "../api/query-keys";

export const useProjectIssues = (projectId: string) =>
  useSandboxQuery(
    (sandboxId) => issueKeys.list(sandboxId, { projectId }),
    (client, signal) => client.listIssues({ projectId }, { signal }),
    { enabled: projectId.length > 0 },
  );

/** Every project's issues (the drawer's Issues screen). */
export const useAllIssues = (enabled = true) =>
  useSandboxQuery(
    (sandboxId) => issueKeys.list(sandboxId),
    (client, signal) => client.listIssues(undefined, { signal }),
    { enabled },
  );

export const useIssueDetail = (issueId: string) =>
  useSandboxQuery(
    (sandboxId) => issueKeys.detail(sandboxId, issueId),
    (client, signal) => client.getIssue(issueId, { signal }),
    { enabled: issueId.length > 0 },
  );

export function useCachedIssue(issueId: string): Issue | undefined {
  const queryClient = useQueryClient();
  const { sandbox } = useSandboxClient();
  return sandbox ? cachedIssue(queryClient, sandbox.id, issueId) : undefined;
}
