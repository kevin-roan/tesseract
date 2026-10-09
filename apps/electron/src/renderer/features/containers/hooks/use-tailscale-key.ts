import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../../../components/FormDialog";
import { showToast } from "../../../components/Toast";
import { ipc } from "../../../lib/ipc";
import { DEFAULT_TAILNET_TAGS } from "../constants";
import { TAILSCALE_LABELS as L } from "../labels";
import { useContainersReport, useSetReport } from "./use-containers-report";

export function useTailscaleKey() {
  const { report } = useContainersReport();
  const setReport = useSetReport();
  const savedTags = report?.tailscaleTags ?? DEFAULT_TAILNET_TAGS;
  const [authKey, setAuthKey] = useState("");
  const [tags, setTags] = useState(savedTags);
  useEffect(() => setTags(savedTags), [savedTags]);
  const save = useMutation({
    mutationFn: (key: string | null | undefined) => ipc.containers.setTailscaleKey({ authKey: key, tags: tags.trim() || DEFAULT_TAILNET_TAGS }),
    onSuccess: (next, key) => {
      setReport(next);
      setAuthKey("");
      showToast(key === null ? L.cleared : L.saved);
    },
    onError: (error) => showToast(L.failed(errorMessage(error))),
  });
  const { mutate } = save;
  const trimmed = authKey.trim();
  const configured = report?.tailscaleKey ?? false;
  const tagsChanged = (tags.trim() || DEFAULT_TAILNET_TAGS) !== savedTags;
  const submit = useCallback(() => {
    if (trimmed) mutate(trimmed);
    else if (configured && tagsChanged) mutate(undefined);
  }, [mutate, trimmed, configured, tagsChanged]);
  const clear = useCallback(() => mutate(null), [mutate]);
  return {
    configured,
    authKey,
    setAuthKey,
    tags,
    setTags,
    canSave: (trimmed.length > 0 || (configured && tagsChanged)) && !save.isPending,
    saving: save.isPending && save.variables !== null,
    clearing: save.isPending && save.variables === null,
    submit,
    clear,
  };
}
