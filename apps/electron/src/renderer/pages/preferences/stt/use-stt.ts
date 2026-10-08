import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SttProfile, SttStatus, UpdateStt } from "@tesseract/protocol";
import { useCallback, useState } from "react";
import { describeError } from "../../../app/connection";
import { sandboxErrorMessage } from "../shared/format";
import { usePreferencesToast } from "../shared/use-preferences-toast";
import { useSandboxLink } from "../shared/use-sandbox-link";
import { STT_KEYS } from "./constants";
import { PROFILE_LABELS, SECTION_LABELS, STT_TOASTS } from "./labels";

export function useStt() {
  const { client, online, baseUrl, offline } = useSandboxLink();
  const queryClient = useQueryClient();
  const toast = usePreferencesToast();
  const [geminiKey, setGeminiKey] = useState("");

  const query = useQuery({
    queryKey: STT_KEYS.status(baseUrl),
    queryFn: ({ signal }) => client!.stt({ signal }),
    enabled: online,
    retry: false,
    staleTime: 0,
  });

  const update = useMutation({
    mutationFn: (body: UpdateStt) => client!.updateStt(body),
    onSuccess: (status: SttStatus, body) => {
      queryClient.setQueryData(STT_KEYS.status(baseUrl), status);
      if (body.profile) toast(STT_TOASTS.changed(PROFILE_LABELS[body.profile].title));
      else if (body.geminiApiKey === null) toast(STT_TOASTS.geminiRemoved);
      else {
        setGeminiKey("");
        toast(STT_TOASTS.geminiSaved);
      }
    },
    onError: (error, body) => {
      const message = describeError(error);
      toast(body.profile ? STT_TOASTS.changeFailed(message) : STT_TOASTS.geminiFailed(message), true);
      if (body.profile) void query.refetch();
    },
  });

  const status = online && !query.error ? (query.data ?? null) : null;
  const message = !online ? offline : query.error ? sandboxErrorMessage(query.error, SECTION_LABELS.outdated) : null;
  const pending = update.isPending;

  const selectProfile = useCallback(
    (profile: SttProfile) => {
      if (status && profile !== status.profile) update.mutate({ profile });
    },
    [status, update],
  );
  const saveKey = useCallback(() => {
    const key = geminiKey.trim();
    if (key) update.mutate({ geminiApiKey: key });
  }, [geminiKey, update]);
  const removeKey = useCallback(() => update.mutate({ geminiApiKey: null }), [update]);
  const refresh = useCallback(() => {
    if (online) void query.refetch();
  }, [online, query]);

  return {
    status,
    message,
    pending,
    pendingProfile: pending ? (update.variables?.profile ?? null) : null,
    geminiKey,
    setGeminiKey,
    selectProfile,
    saveKey,
    removeKey,
    refresh,
  };
}
