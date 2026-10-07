import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import type { DockerInstallRequest, DockerPhase, DockerReport } from "../../../shared/contracts/docker";
import type { OnboardingUrlKey } from "../../../shared/contracts/onboarding";
import { IpcError } from "../../../shared/ipc-types";
import { showToast, TOAST_TIMEOUT_MS } from "../../components/Toast";
import { ipc } from "../../lib/ipc";
import { ONBOARDING_TOAST_SCOPE } from "../shell";
import { DOCKER_LOG_LIMIT, DOCKER_QUERY_KEYS } from "./constants";
import { DOCKER_LABELS } from "./labels";
import { appendLog } from "./model";

const IDLE: DockerPhase = { kind: "idle" };
const NO_LINES: string[] = [];

function reportFailure(error: unknown): void {
  const cancelled = error instanceof IpcError && error.code === "cancelled";
  const message = cancelled ? DOCKER_LABELS.install.cancelled : error instanceof Error ? error.message : String(error);
  showToast(message, { scope: ONBOARDING_TOAST_SCOPE, timeoutMs: cancelled ? TOAST_TIMEOUT_MS.default : TOAST_TIMEOUT_MS.failure });
}

export interface DockerController {
  report: DockerReport | null;
  phase: DockerPhase;
  log: string[];
  checking: boolean;
  error: string | null;
  check(): void;
  install(request: DockerInstallRequest): void;
  start(): void;
  cancel(): void;
  openUrl(key: OnboardingUrlKey): void;
}

export function useDocker(): DockerController {
  const client = useQueryClient();
  const report = useQuery({
    queryKey: DOCKER_QUERY_KEYS.report,
    queryFn: () => ipc.docker.check(),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });
  const phase = useQuery({
    queryKey: DOCKER_QUERY_KEYS.phase,
    queryFn: () => ipc.docker.phase(),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });
  const log = useQuery({
    queryKey: DOCKER_QUERY_KEYS.log,
    queryFn: () => ipc.docker.log(),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const stops = [
      ipc.docker.on("report", (next) => client.setQueryData(DOCKER_QUERY_KEYS.report, next)),
      ipc.docker.on("phase", (next) => client.setQueryData(DOCKER_QUERY_KEYS.phase, next)),
      ipc.docker.on("log", (line) =>
        client.setQueryData<string[]>(DOCKER_QUERY_KEYS.log, (lines) => appendLog(lines ?? [], line, DOCKER_LOG_LIMIT)),
      ),
    ];
    return () => stops.forEach((stop) => stop());
  }, [client]);

  const setPhase = useCallback((next: DockerPhase) => client.setQueryData(DOCKER_QUERY_KEYS.phase, next), [client]);
  const install = useMutation({
    mutationFn: (request: DockerInstallRequest) => ipc.docker.install(request),
    onSuccess: setPhase,
    onError: reportFailure,
    onSettled: () => void report.refetch(),
  });
  const start = useMutation({
    mutationFn: () => ipc.docker.start(),
    onSuccess: setPhase,
    onError: reportFailure,
    onSettled: () => void report.refetch(),
  });
  const cancel = useMutation({ mutationFn: () => ipc.docker.cancel(), onSuccess: setPhase, onError: reportFailure });

  return {
    report: report.data ?? null,
    phase: phase.data ?? IDLE,
    log: log.data ?? NO_LINES,
    checking: report.isFetching,
    error: report.error instanceof Error ? report.error.message : null,
    check: () => void report.refetch(),
    install: (request) => install.mutate(request),
    start: () => start.mutate(),
    cancel: () => cancel.mutate(),
    openUrl: (key) => void ipc.onboarding.openExternal(key).catch(reportFailure),
  };
}
