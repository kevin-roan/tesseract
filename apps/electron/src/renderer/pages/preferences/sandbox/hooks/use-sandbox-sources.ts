import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { BuildPhase } from "../../../../../shared/contracts/sandbox";
import { ipc } from "../../../../lib/ipc";
import { SANDBOX_SETTINGS_KEYS as KEYS } from "../constants";
import { appendLog, lastFraction } from "../model";

const IDLE: BuildPhase = { kind: "idle" };
const ONCE = { retry: false, staleTime: Number.POSITIVE_INFINITY, refetchOnWindowFocus: false } as const;

export function useSandboxSources() {
  const queryClient = useQueryClient();
  const [log, setLog] = useState<string[]>([]);
  const fraction = useRef(0);

  useEffect(() => {
    const stops = [
      ipc.docker.on("report", (report) => queryClient.setQueryData(KEYS.docker, report)),
      ipc.sandbox.on("status", (status) => queryClient.setQueryData(KEYS.status, status)),
      ipc.sandbox.on("phase", (phase) => queryClient.setQueryData(KEYS.phase, phase)),
      ipc.sandbox.on("log", (line) => setLog((lines) => appendLog(lines, line))),
    ];
    return () => stops.forEach((stop) => stop());
  }, [queryClient]);

  const docker = useQuery({ queryKey: KEYS.docker, queryFn: () => ipc.docker.check(), ...ONCE });
  const stack = useQuery({ queryKey: KEYS.stack, queryFn: () => ipc.sandbox.stack(), ...ONCE });
  const status = useQuery({ queryKey: KEYS.status, queryFn: () => ipc.sandbox.status(), ...ONCE });
  const defaults = useQuery({ queryKey: KEYS.defaults, queryFn: () => ipc.sandbox.defaults(), ...ONCE });
  const phaseQuery = useQuery({ queryKey: KEYS.phase, queryFn: () => ipc.sandbox.phase(), ...ONCE });

  const phase = phaseQuery.data ?? IDLE;
  fraction.current = lastFraction(fraction.current, phase);

  return {
    docker: docker.data ?? null,
    dockerChecking: docker.isFetching,
    recheckDocker: () => void docker.refetch(),
    stack: stack.data ?? null,
    status: status.data ?? null,
    defaults: defaults.data ?? null,
    phase,
    fraction: fraction.current,
    log,
    clearLog: () => setLog([]),
  };
}

export type SandboxSources = ReturnType<typeof useSandboxSources>;
