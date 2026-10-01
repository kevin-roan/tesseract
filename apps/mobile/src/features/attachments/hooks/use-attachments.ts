import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { describeError } from "@/features/sandbox/utils/errors";

import { PICKERS } from "../services/pickers";
import type { AttachSource, DraftAttachment, PickedFile, PickerSource } from "../types";
import { admitFiles, draftKey, remainingSlots, tooManyMessage, uploadKindOf } from "../utils/files";
import { useUploadFile } from "./use-upload-file";

export type AttachmentsState = ReturnType<typeof useAttachments>;

export function useAttachments() {
  const upload = useUploadFile();
  const [items, setItems] = useState<DraftAttachment[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const patch = useCallback(
    (key: string, next: Partial<DraftAttachment>) =>
      setItems((current) => current.map((item) => (item.key === key ? { ...item, ...next } : item))),
    [],
  );

  const send = useCallback(
    async (item: DraftAttachment) => {
      patch(item.key, { status: "uploading", error: null });
      try {
        const result = await upload(item);
        patch(item.key, { status: "ready", upload: result });
      } catch (error) {
        patch(item.key, { status: "error", error: describeError(error) });
      }
    },
    [patch, upload],
  );

  const add = useCallback(
    (files: PickedFile[], source: AttachSource) => {
      const { accepted, rejected } = admitFiles(files, itemsRef.current.length);
      setNotice(rejected.length > 0 ? rejected.join(" ") : null);
      const drafts = accepted.map<DraftAttachment>((file, index) => ({
        ...file,
        key: draftKey(source, index),
        kind: uploadKindOf(file.mimeType),
        status: "uploading",
        upload: null,
        error: null,
      }));
      if (drafts.length === 0) return;
      itemsRef.current = [...itemsRef.current, ...drafts];
      setItems(itemsRef.current);
      drafts.forEach((draft) => void send(draft));
    },
    [send],
  );

  const pick = useCallback(
    async (source: PickerSource) => {
      const slots = remainingSlots(itemsRef.current.length);
      if (slots === 0) {
        setNotice(tooManyMessage());
        return;
      }
      try {
        add(await PICKERS[source](slots), source);
      } catch (error) {
        setNotice(describeError(error));
      }
    },
    [add],
  );

  const remove = useCallback((key: string) => {
    itemsRef.current = itemsRef.current.filter((item) => item.key !== key);
    setItems(itemsRef.current);
    setNotice(null);
  }, []);

  const retry = useCallback(
    (key: string) => {
      const item = itemsRef.current.find((candidate) => candidate.key === key);
      if (item) void send(item);
    },
    [send],
  );

  const clear = useCallback(() => {
    itemsRef.current = [];
    setItems([]);
    setNotice(null);
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const derived = useMemo(() => {
    const uploadIds = items.flatMap((item) => (item.upload && item.status === "ready" ? [item.upload.id] : []));
    return {
      uploadIds,
      isUploading: items.some((item) => item.status === "uploading"),
      hasFailed: items.some((item) => item.status === "error"),
      canAttach: remainingSlots(items.length) > 0,
    };
  }, [items]);

  return { items, notice, pick, add, remove, retry, clear, dismissNotice, ...derived };
}
