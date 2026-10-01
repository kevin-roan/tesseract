import { useSandboxQuery } from "@/features/sandbox/hooks/use-sandbox-query";

import { claudeKeys } from "../api/query-keys";

export const useClaudeAuth = () =>
  useSandboxQuery(claudeKeys.auth, (client, signal) => client.claudeAuth({ signal }));
