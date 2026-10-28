import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { describeError } from "../../../../../app/connection";
import { DATA_KEYS, useApiClient, useApiQuery } from "../../../../../app/data";
import type { ChoiceOption } from "../../../../../components/ChoiceDropdown";
import { DEFAULT_MODEL_KEY } from "../../../../../features/agents/constants";
import { useAgentAttachments, type AgentAttachments } from "../../../../../features/agents/hooks/use-attachments";
import { runModel, type ModelKey } from "../../../../../features/agents/model";
import { CLAUDE_ACCOUNT_LABELS } from "../../../../../features/projects/labels";
import { claudeAccountOptions, effectiveAccount } from "../../../../../features/projects/model";
import { showToast } from "../../../../../components/Toast";
import { HOST_CHAT_ACCOUNTS_KEY, HOST_CHAT_PROJECT_KEY, HOST_CHAT_REFRESH_MS, HOST_CHAT_RUNS_KEY } from "../constants";
import { HOST_REPO_LABELS as L } from "../labels";
import { NEW_CHAT, hostChatOptions } from "../model";

export interface HostChat {
  runId: string | null;
  options: ChoiceOption[];
  select(id: string): void;
  prompt: string;
  setPrompt(prompt: string): void;
  model: ModelKey;
  setModel(model: ModelKey): void;
  attachments: AgentAttachments;
  busy: boolean;
  error: string | null;
  submit(text: string): void;
  account: HostChatAccount;
}

export interface HostChatAccount {
  options: ChoiceOption[] | null;
  value: string;
  busy: boolean;
  change(value: string): void;
}

/** Runs inside `ApiClientScope`: every call goes to the host workspace controller. */
export function useHostChat(projectId: string): HostChat {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ModelKey>(DEFAULT_MODEL_KEY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attachments = useAgentAttachments(runId === null);
  const runs = useApiQuery([...HOST_CHAT_RUNS_KEY, projectId], (api, signal) => api.listAgentRuns({ projectId }, { signal }), {
    refetchInterval: HOST_CHAT_REFRESH_MS,
  });
  const options = useMemo(() => hostChatOptions(runs.data), [runs.data]);
  const project = useApiQuery([...HOST_CHAT_PROJECT_KEY, projectId], (api, signal) => api.getProject(projectId, { signal }));
  const accounts = useApiQuery(HOST_CHAT_ACCOUNTS_KEY, (api, signal) => api.claudeAccounts({ signal }));
  const [accountBusy, setAccountBusy] = useState(false);
  const accountOptions = useMemo(
    () => (project.data && accounts.data ? claudeAccountOptions(project.data, accounts.data) : null),
    [project.data, accounts.data],
  );

  const changeAccount = useCallback(
    async (value: string) => {
      const current = project.data;
      if (!client || !current || (value || null) === (current.claudeAccountId ?? null)) return;
      setAccountBusy(true);
      try {
        const updated = await client.setProjectClaudeAccount(projectId, { accountId: value || null });
        queryClient.setQueryData(DATA_KEYS.api(client.baseUrl, ...HOST_CHAT_PROJECT_KEY, projectId), updated);
        const account = accounts.data ? effectiveAccount(updated, accounts.data) : value;
        showToast(CLAUDE_ACCOUNT_LABELS.changed(updated.name || updated.id, account));
      } catch (failure) {
        setError(CLAUDE_ACCOUNT_LABELS.failed(describeError(failure)));
      } finally {
        setAccountBusy(false);
      }
    },
    [client, project.data, accounts.data, projectId, queryClient],
  );

  const select = useCallback((id: string) => setRunId(id === NEW_CHAT ? null : id), []);

  const submit = useCallback(
    async (text: string) => {
      if (!client || busy || !text.trim()) return;
      setBusy(true);
      setError(null);
      try {
        const run = await client.startAgentRun({
          prompt: attachments.prompt(text),
          projectId,
          ...(attachments.uploadIds.length ? { attachmentIds: attachments.uploadIds } : {}),
          ...(runModel(model) ? { model: runModel(model) } : {}),
        });
        attachments.clear();
        setPrompt("");
        setRunId(run.id);
        void queryClient.invalidateQueries({ queryKey: DATA_KEYS.api(client.baseUrl, ...HOST_CHAT_RUNS_KEY) });
      } catch (failure) {
        setError(L.chatFailed(describeError(failure)));
      } finally {
        setBusy(false);
      }
    },
    [client, busy, attachments, projectId, model, queryClient],
  );

  return {
    runId,
    options,
    select,
    prompt,
    setPrompt,
    model,
    setModel,
    attachments,
    busy,
    error,
    submit: (text) => void submit(text),
    account: {
      options: accountOptions,
      value: project.data?.claudeAccountId ?? "",
      busy: accountBusy,
      change: (value) => void changeAccount(value),
    },
  };
}
