import type { SessionsFilter } from "@tesseract/protocol";

import { useSandboxQuery } from "@/features/sandbox/hooks/use-sandbox-query";

import { sessionKeys } from "../api/query-keys";

export const useSessions = (filter: SessionsFilter = {}) =>
  useSandboxQuery(
    (sandboxId) => sessionKeys.list(sandboxId, filter),
    (client, signal) => client.sessions(filter, { signal }),
  );
