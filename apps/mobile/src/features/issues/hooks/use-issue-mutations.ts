import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateIssue, CreateIssueComment, DispatchIssue, Issue, UpdateIssue } from "@tesseract/protocol";

import { useSandboxClient } from "@/features/sandbox/hooks/use-sandbox-client";
import { useSandboxMutation } from "@/features/sandbox/hooks/use-sandbox-mutations";

import { cachedIssue, removeIssue, storeIssue, storeIssueComment } from "../api/cache";

export type IssuePatch = UpdateIssue & { id: string };

export const useCreateIssue = () =>
  useSandboxMutation(
    (client, { projectId, ...body }: CreateIssue & { projectId: string }) => client.createIssue(projectId, body),
    (queryClient, sandboxId, issue) => storeIssue(queryClient, sandboxId, issue),
  );

export const useDeleteIssue = () =>
  useSandboxMutation(
    (client, issueId: string) => client.deleteIssue(issueId),
    (queryClient, sandboxId, _issue, issueId) => removeIssue(queryClient, sandboxId, issueId),
  );

export const useCommentOnIssue = () =>
  useSandboxMutation(
    (client, { issueId, ...body }: CreateIssueComment & { issueId: string }) => client.commentOnIssue(issueId, body),
    (queryClient, sandboxId, comment) => storeIssueComment(queryClient, sandboxId, comment),
  );

export const useDispatchIssue = () =>
  useSandboxMutation(
    (client, { issueId, ...body }: DispatchIssue & { issueId: string }) => client.dispatchIssue(issueId, body),
    (queryClient, sandboxId, issue) => storeIssue(queryClient, sandboxId, issue),
  );

/** Applies the patch to every cached copy right away and rolls it back if the controller refuses it. */
export function useUpdateIssue() {
  const { sandbox, client } = useSandboxClient();
  const queryClient = useQueryClient();
  const sandboxId = sandbox?.id ?? null;
  return useMutation<Issue, Error, IssuePatch, { previous: Issue | undefined }>({
    mutationFn: ({ id, ...body }) => {
      if (!client) throw new Error("No sandbox is paired.");
      return client.updateIssue(id, body);
    },
    onMutate: async ({ id, ...body }) => {
      if (!sandboxId) return { previous: undefined };
      const previous = cachedIssue(queryClient, sandboxId, id);
      if (previous) storeIssue(queryClient, sandboxId, { ...previous, ...body });
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (sandboxId && context?.previous) storeIssue(queryClient, sandboxId, context.previous);
    },
    onSuccess: (issue) => {
      if (sandboxId) storeIssue(queryClient, sandboxId, issue);
    },
  });
}
