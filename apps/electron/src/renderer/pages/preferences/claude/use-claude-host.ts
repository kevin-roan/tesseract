import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { ipc } from "../../../lib/ipc";
import { CLAUDE_KEYS } from "./constants";

export function useClaudeHost() {
  const query = useQuery({ queryKey: CLAUDE_KEYS.host, queryFn: () => ipc.claude.hostAccounts(), staleTime: 0 });
  const firstId = useRef<string | null>(null);
  const accounts = query.data ?? null;
  if (firstId.current === null && accounts && accounts.length > 0) firstId.current = accounts[0]!.id;
  return { accounts, firstId: firstId.current, refetch: query.refetch };
}
