import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AndroidStreamEncoding } from "@tesseract/protocol";
import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { errorMessage, useResetOnOpen, useSubmitAction } from "../../../components/FormDialog";
import { showToast } from "../../../components/Toast";
import { useHostAccess } from "../../host-shell/hooks/use-host-access";
import { STREAM_SETTINGS_KEY } from "../constants";
import { STREAM_LABELS as L } from "../labels";
import { maxSizeOptions, parseStreamDraft, streamChanges, streamDraft, type StreamDraft, type StreamErrors } from "../stream";
import type { DeviceKind, StreamField } from "../types";

/** Reads and saves the host's stream settings for one device kind (`/v1/{android,ios}/stream`). */
export function useStreamSettings(kind: DeviceKind, open: boolean, onClose: () => void) {
  const { client, state } = useHostAccess();
  const queryClient = useQueryClient();
  const url = client ? (state?.pairing?.url ?? "") : "";
  const key = useMemo(() => [...STREAM_SETTINGS_KEY, kind.id, url], [kind.id, url]);
  const query = useQuery({
    queryKey: key,
    queryFn: () => (client ? kind.stream.get(client) : Promise.reject(new Error(L.noHost))),
    enabled: open && client !== null,
    retry: false,
  });
  const submit = useSubmitAction();
  const [edits, setEdits] = useState<Partial<StreamDraft>>({});
  const [errors, setErrors] = useState<StreamErrors>({});

  useResetOnOpen(open, () => {
    setEdits({});
    setErrors({});
    submit.reset();
  });

  const saved = query.data ?? null;
  const draft = saved ? { ...streamDraft(saved), ...edits } : null;

  const edit = useCallback((patch: Partial<StreamDraft>) => setEdits((current) => ({ ...current, ...patch })), []);

  const field = (name: StreamField) => ({
    value: draft?.[name] ?? "",
    error: Boolean(errors[name]),
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      edit({ [name]: event.target.value });
      setErrors(({ [name]: _cleared, ...rest }) => rest);
    },
  });

  const save = async () => {
    if (!client || !saved || !draft || submit.busy) return;
    const parsed = parseStreamDraft(draft);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    const changes = streamChanges(saved, parsed.settings);
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    await submit.run(
      async () => {
        queryClient.setQueryData(key, await kind.stream.update(client, changes));
        showToast(L.saved);
        onClose();
      },
      (error) => L.failed(errorMessage(error)),
    );
  };

  return {
    ready: draft !== null,
    loading: open && query.isPending && client !== null,
    encoding: draft?.encoding ?? null,
    setEncoding: (encoding: AndroidStreamEncoding) => edit({ encoding }),
    maxSize: draft?.maxSize ?? null,
    setMaxSize: (maxSize: string) => edit({ maxSize }),
    maxSizes: maxSizeOptions(saved?.maxSize ?? null),
    field,
    errorsFor: (...names: StreamField[]) => names.map((name) => errors[name]).filter((message): message is string => Boolean(message)),
    busy: submit.busy,
    error: submit.error ?? (client ? (query.error ? errorMessage(query.error) : null) : L.noHost),
    onSubmit: () => void save(),
  };
}
