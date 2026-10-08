import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InboxCounts, MarkInboxRead } from "@tesseract/protocol";

import { useSandboxClient } from "@/features/sandbox/hooks/use-sandbox-client";
import { useSandboxQuery } from "@/features/sandbox/hooks/use-sandbox-query";

import { storeInboxRead } from "../api/cache";
import { inboxKeys } from "../api/query-keys";
import { INBOX_FETCH_LIMIT } from "../utils/constants";

export const useInbox = () =>
  useSandboxQuery(inboxKeys.list, (client, signal) => client.inbox({ limit: INBOX_FETCH_LIMIT }, { signal }));

export function useMarkInboxRead() {
  const { sandbox, client } = useSandboxClient();
  const queryClient = useQueryClient();
  return useMutation<InboxCounts, Error, MarkInboxRead>({
    mutationFn: async (body) => {
      if (!client || !sandbox) throw new Error("No sandbox is paired.");
      const counts = await client.markInboxRead(body);
      storeInboxRead(queryClient, sandbox.id, "ids" in body ? body.ids : "all", counts);
      return counts;
    },
  });
}
