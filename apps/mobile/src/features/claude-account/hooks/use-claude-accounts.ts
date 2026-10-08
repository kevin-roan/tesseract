import type { ClaudeAccountList, SetDefaultClaudeAccount, SetProjectClaudeAccount } from "@tesseract/protocol";

import { storeProject } from "@/features/sandbox/api/cache";
import { sandboxKeys } from "@/features/sandbox/api/query-keys";
import { useSandboxMutation } from "@/features/sandbox/hooks/use-sandbox-mutations";
import { useSandboxQuery } from "@/features/sandbox/hooks/use-sandbox-query";

import { claudeKeys } from "../api/query-keys";

export const useClaudeAccounts = () =>
  useSandboxQuery(claudeKeys.accounts, (client, signal) => client.claudeAccounts({ signal }));

export const useSetDefaultClaudeAccount = () =>
  useSandboxMutation(
    (client, body: SetDefaultClaudeAccount) => client.setDefaultClaudeAccount(body),
    (queryClient, sandboxId, list: ClaudeAccountList) => {
      queryClient.setQueryData(claudeKeys.accounts(sandboxId), list);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: claudeKeys.auth(sandboxId) }),
        queryClient.invalidateQueries({ queryKey: sandboxKeys.projects(sandboxId) }),
      ]);
    },
  );

export const useSetProjectClaudeAccount = () =>
  useSandboxMutation(
    (client, { projectId, ...body }: SetProjectClaudeAccount & { projectId: string }) =>
      client.setProjectClaudeAccount(projectId, body),
    (queryClient, sandboxId, project) => {
      storeProject(queryClient, sandboxId, project);
      return queryClient.invalidateQueries({ queryKey: sandboxKeys.projects(sandboxId), exact: true });
    },
  );
