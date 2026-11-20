import { useMemo, useState } from "react";
import { useApiQuery } from "../../../app/data";
import { AGENTS_QUERY_KEYS, SHELL_POLL_INTERVAL_MS } from "../../../features/agents/constants";
import { shellLogLines, visibleShells } from "../../../features/agents/shells";

const NO_SHELLS: readonly never[] = [];

export function useAgentShells(runId: string | null, running: boolean, active: boolean) {
  const [openId, setOpenId] = useState<string | null>(null);
  const polling = runId !== null && running && active;

  const list = useApiQuery(AGENTS_QUERY_KEYS.shells(runId ?? ""), (client, signal) => client.listAgentShells(runId ?? "", { signal }), {
    enabled: polling,
    refetchInterval: SHELL_POLL_INTERVAL_MS,
    retry: false,
  });
  const shells = useMemo(() => visibleShells((running && list.data) || NO_SHELLS, openId), [running, list.data, openId]);
  const open = shells.find((shell) => shell.id === openId) ?? null;

  const log = useApiQuery(AGENTS_QUERY_KEYS.shellLog(runId ?? "", open?.id ?? ""), (client, signal) => client.agentShellLog(runId ?? "", open?.id ?? "", { signal }), {
    enabled: polling && open !== null,
    refetchInterval: open?.running ? SHELL_POLL_INTERVAL_MS : false,
    retry: false,
  });
  const lines = useMemo(() => shellLogLines(log.data?.text ?? ""), [log.data?.text]);

  return {
    shells,
    runningCount: shells.filter((shell) => shell.running).length,
    open,
    lines,
    truncated: log.data?.truncated ?? false,
    toggle: (id: string) => setOpenId((current) => (current === id ? null : id)),
    close: () => setOpenId(null),
  };
}
