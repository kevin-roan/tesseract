import { useCallback, useMemo, useState } from "react";

import { useUpdateStt } from "@/features/sandbox/hooks/use-sandbox-mutations";
import { useSttStatus } from "@/features/sandbox/hooks/use-sandbox-queries";
import { describeError } from "@/features/sandbox/utils/errors";

import { geminiKeyHint, geminiUnavailable, isSttProfile, isSttProvider, sttProfileRows, sttProviderRows } from "../utils/stt";
import { useSetSttProvider, useSttProvider } from "./use-stt-provider";

export function useSttSettings() {
  const provider = useSttProvider();
  const setProvider = useSetSttProvider();
  const status = useSttStatus();
  const update = useUpdateStt();
  const data = status.data;
  const pending = update.isPending ? (update.variables?.profile ?? null) : null;
  const pendingKey = update.isPending ? update.variables?.geminiApiKey : undefined;
  const [keyDraft, setKeyDraft] = useState("");

  const providerRows = useMemo(() => sttProviderRows(provider, data), [provider, data]);
  const profileRows = useMemo(() => (data ? sttProfileRows(data, pending) : null), [data, pending]);

  const selectProvider = useCallback(
    (id: string) => {
      if (isSttProvider(id)) setProvider(id);
    },
    [setProvider],
  );

  const { mutate, isPending } = update;
  const selectProfile = useCallback(
    (id: string) => {
      if (isPending || !isSttProfile(id) || id === data?.profile) return;
      mutate({ profile: id });
    },
    [isPending, mutate, data?.profile],
  );

  const saveKey = useCallback(() => {
    const key = keyDraft.trim();
    if (isPending || !key) return;
    mutate({ geminiApiKey: key }, { onSuccess: () => setKeyDraft("") });
  }, [isPending, keyDraft, mutate]);

  const removeKey = useCallback(() => {
    if (!isPending) mutate({ geminiApiKey: null });
  }, [isPending, mutate]);

  return {
    providerRows,
    selectProvider,
    geminiMissing: geminiUnavailable(provider, data),
    profileRows,
    selectProfile,
    geminiKey: data
      ? {
          value: keyDraft,
          onChange: setKeyDraft,
          hint: geminiKeyHint(data),
          save: saveKey,
          saving: typeof pendingKey === "string",
          remove: data.gemini.source === "settings" ? removeKey : undefined,
          removing: pendingKey === null,
        }
      : null,
    loading: status.isLoading,
    engineIssue: data && !data.ready ? data.reason : null,
    error: status.error ? describeError(status.error) : null,
    retry: () => void status.refetch(),
    updateError: update.error ? describeError(update.error) : null,
  };
}
