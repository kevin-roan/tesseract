import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { TheOneClient } from "@theone/client";
import type {
  CreateProject,
  CreateSyncRequest,
  CreateTerminal,
  CreateTranscription,
  CreateUpload,
  RenameProject,
  SendArtifact,
  StartAgentRun,
  StartBuild,
  StartProcess,
  SyncDiscard,
  UpdateStt,
} from "@theone/protocol";

import { unregisterPushToken } from "@/features/inbox/api/push";

import { forgetSandboxClient } from "../api/client";
import {
  removeArtifact,
  removeProject,
  storeAgentRun,
  storeArtifact,
  storeBuild,
  storeProcess,
  storeProject,
  storeSyncChanges,
  storeSyncRequest,
  storeTerminal,
} from "../api/cache";
import { sandboxKeys } from "../api/query-keys";
import { pairSandbox } from "../api/pairing";
import { useConnectionStore } from "../store/connection-store";
import { useSandboxStore } from "../store/sandbox-store";
import { UPLOAD_TIMEOUT_MS } from "../utils/constants";
import type { ValidPairing } from "../utils/pairing";
import { useSandboxClient } from "./use-sandbox-client";

type Effects<TData, TVars> = (queryClient: QueryClient, sandboxId: string, data: TData, variables: TVars) => unknown;

export function useSandboxMutation<TVars, TData>(
  run: (client: TheOneClient, variables: TVars) => Promise<TData>,
  effects: Effects<TData, TVars>,
) {
  const { sandbox, client } = useSandboxClient();
  const queryClient = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn: async (variables) => {
      if (!client || !sandbox) throw new Error("No sandbox is paired.");
      const data = await run(client, variables);
      await effects(queryClient, sandbox.id, data, variables);
      return data;
    },
  });
}

export const useCreateProject = () =>
  useSandboxMutation(
    (client, body: CreateProject) => client.createProject(body),
    (queryClient, sandboxId, { project }) => {
      storeProject(queryClient, sandboxId, project);
      return queryClient.invalidateQueries({ queryKey: sandboxKeys.projects(sandboxId), exact: true });
    },
  );

export const useDeleteProject = () =>
  useSandboxMutation(
    (client, { id, force }: { id: string; force: boolean }) => client.deleteProject(id, force ? { force } : undefined),
    (queryClient, sandboxId, { id }) => removeProject(queryClient, sandboxId, id),
  );

export const useRenameProject = () =>
  useSandboxMutation(
    (client, { id, ...body }: RenameProject & { id: string }) => client.renameProject(id, body),
    (queryClient, sandboxId, project) => {
      storeProject(queryClient, sandboxId, project);
      return queryClient.invalidateQueries({ queryKey: sandboxKeys.projects(sandboxId), exact: true });
    },
  );

export const useStartProcess = () =>
  useSandboxMutation(
    (client, body: StartProcess) => client.startProcess(body),
    (queryClient, sandboxId, process) => {
      storeProcess(queryClient, sandboxId, process);
      return queryClient.invalidateQueries({ queryKey: sandboxKeys.processLists(sandboxId) });
    },
  );

export const useStopProcess = () =>
  useSandboxMutation(
    (client, processId: string) => client.stopProcess(processId),
    (queryClient, sandboxId, process) => storeProcess(queryClient, sandboxId, process),
  );

export const useCreateTerminal = () =>
  useSandboxMutation(
    (client, body: CreateTerminal) => client.createTerminal(body),
    (queryClient, sandboxId, terminal) => storeTerminal(queryClient, sandboxId, terminal),
  );

export const useCloseTerminal = () =>
  useSandboxMutation(
    (client, terminalId: string) => client.closeTerminal(terminalId),
    (queryClient, sandboxId, terminal) => storeTerminal(queryClient, sandboxId, terminal),
  );

export const useStartBuild = () =>
  useSandboxMutation(
    (client, body: StartBuild) => client.startBuild(body),
    (queryClient, sandboxId, build) => {
      storeBuild(queryClient, sandboxId, build);
      return queryClient.invalidateQueries({ queryKey: sandboxKeys.buildLists(sandboxId) });
    },
  );

export const useCancelBuild = () =>
  useSandboxMutation(
    (client, buildId: string) => client.cancelBuild(buildId),
    (queryClient, sandboxId, build) => storeBuild(queryClient, sandboxId, build),
  );

export const useStartAgentRun = () =>
  useSandboxMutation(
    (client, body: StartAgentRun) => client.startAgentRun(body),
    (queryClient, sandboxId, run) => {
      storeAgentRun(queryClient, sandboxId, run, true);
      return queryClient.invalidateQueries({ queryKey: sandboxKeys.agentRunLists(sandboxId) });
    },
  );

export const useCreateUpload = () =>
  useSandboxMutation(
    (client, body: CreateUpload) => client.createUpload(body, { timeoutMs: UPLOAD_TIMEOUT_MS }),
    () => undefined,
  );

export const useTranscribe = () =>
  useSandboxMutation(
    (client, body: CreateTranscription) => client.transcribe(body, { timeoutMs: UPLOAD_TIMEOUT_MS }),
    () => undefined,
  );

export const useUpdateStt = () =>
  useSandboxMutation(
    (client, body: UpdateStt) => client.updateStt(body),
    (queryClient, sandboxId, status) => queryClient.setQueryData(sandboxKeys.stt(sandboxId), status),
  );

export const useCancelAgentRun = () =>
  useSandboxMutation(
    (client, runId: string) => client.cancelAgentRun(runId),
    (queryClient, sandboxId, run) => storeAgentRun(queryClient, sandboxId, run),
  );

export const useDeleteArtifact = () =>
  useSandboxMutation(
    (client, artifactId: string) => client.deleteArtifact(artifactId),
    (queryClient, sandboxId, _artifact, artifactId) => removeArtifact(queryClient, sandboxId, artifactId),
  );

export const useSendArtifactToTaildrop = () =>
  useSandboxMutation(
    (client, { artifactId, ...body }: SendArtifact & { artifactId: string }) =>
      client.sendArtifactToTaildrop(artifactId, body, { timeoutMs: UPLOAD_TIMEOUT_MS }),
    (queryClient, sandboxId, artifact) => storeArtifact(queryClient, sandboxId, artifact),
  );

export const useCreateSyncRequest = () =>
  useSandboxMutation(
    (client, { projectId, ...body }: CreateSyncRequest & { projectId: string }) =>
      client.createSyncRequest(projectId, body),
    (queryClient, sandboxId, request) => storeSyncRequest(queryClient, sandboxId, request),
  );

export const useCancelSyncRequest = () =>
  useSandboxMutation(
    (client, requestId: string) => client.cancelSyncRequest(requestId),
    (queryClient, sandboxId, request) => storeSyncRequest(queryClient, sandboxId, request),
  );

export const useDiscardSyncChanges = () =>
  useSandboxMutation(
    (client, { projectId, ...body }: SyncDiscard & { projectId: string }) => client.syncDiscard(projectId, body),
    (queryClient, sandboxId, result) => storeSyncChanges(queryClient, sandboxId, result.changes),
  );

const refreshWindows = (queryClient: QueryClient, sandboxId: string) =>
  queryClient.invalidateQueries({ queryKey: sandboxKeys.displayWindows(sandboxId), exact: true });

export const useActivateDisplayWindow = () =>
  useSandboxMutation(
    (client, id: string) => client.activateDisplayWindow(id),
    (queryClient, sandboxId) => refreshWindows(queryClient, sandboxId),
  );

export const useCloseDisplayWindow = () =>
  useSandboxMutation(
    (client, { id, force }: { id: string; force: boolean }) => client.closeDisplayWindow(id, force ? { force } : {}),
    (queryClient, sandboxId) => refreshWindows(queryClient, sandboxId),
  );

export function usePairSandbox() {
  const addSandbox = useSandboxStore((state) => state.addSandbox);
  return useMutation({
    mutationFn: (pairing: ValidPairing) => pairSandbox(pairing, addSandbox),
  });
}

export function useRemoveSandbox() {
  const queryClient = useQueryClient();
  const removeSandbox = useSandboxStore((state) => state.removeSandbox);
  const clearLink = useConnectionStore((state) => state.clearLink);
  return useMutation({
    mutationFn: (sandboxId: string) => {
      unregisterPushToken(sandboxId);
      return removeSandbox(sandboxId);
    },
    onSuccess: (_data, sandboxId) => {
      forgetSandboxClient(sandboxId);
      clearLink(sandboxId);
      queryClient.removeQueries({ queryKey: sandboxKeys.all(sandboxId) });
    },
  });
}
