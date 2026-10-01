import { useSandboxQuery } from "@/features/sandbox/hooks/use-sandbox-query";

import { usageKeys } from "../api/query-keys";
import type { UsageRange } from "../utils/usage";

export const useUsage = (days: UsageRange) =>
  useSandboxQuery(
    (sandboxId) => usageKeys.report(sandboxId, days),
    (client, signal) => client.usage({ days }, { signal }),
  );
