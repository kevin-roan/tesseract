import { LIMITS } from "@tesseract/protocol";
import { useCallback, useMemo, useRef, useState } from "react";
import { describeError } from "../../../app/connection";
import { useApiClient } from "../../../app/data";
import type { AttachKind } from "../../../components/Composer";
import { showToast } from "../../../components/Toast";
import { ATTACHMENT_LABELS, formatLabel } from "../labels";
import { ipc } from "../../../lib/ipc";
import {
  admitFiles,
  bytesToBase64,
  draftKey,
  isBlocked,
  mimeTypeOf,
  promptWithAttachments,
  tooManyMessage,
  uploadIds,
  uploadKindOf,
  uploadName,
  type DraftAttachment,
} from "../attachments";
import { ATTACH_TOAST_TIMEOUT_MS, PNG_MIME_TYPE, UPLOAD_TIMEOUT_MS } from "../constants";

export interface AgentAttachments {
  drafts: readonly DraftAttachment[];
  hasItems: boolean;
  blocked: boolean;
  uploadIds: string[];
  attach(kind: AttachKind): void;
  dropFiles(files: File[]): void;
  remove(key: string): void;
  retry(key: string): void;
  clear(): void;
  prompt(text: string): string;
}

interface FileData {
  name: string;
  mimeType: string;
  size: number;
  base64: string;
}

const toast = (message: string) => showToast(message, { timeoutMs: ATTACH_TOAST_TIMEOUT_MS });

function previewFor(data: FileData): string | null {
  return data.mimeType.startsWith("image/") ? `data:${data.mimeType};base64,${data.base64}` : null;
}

export function useAgentAttachments(enabled = true): AgentAttachments {
  const client = useApiClient();
  const [drafts, setDrafts] = useState<DraftAttachment[]>([]);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  const patch = useCallback((key: string, changes: Partial<DraftAttachment>) => {
    setDrafts((current) => current.map((draft) => (draft.key === key ? { ...draft, ...changes } : draft)));
  }, []);

  const upload = useCallback(
    (draft: DraftAttachment) => {
      if (!client) {
        patch(draft.key, { status: "error", error: describeError(new Error("Not connected")) });
        return;
      }
      client
        .createUpload({ name: uploadName(draft.name), mimeType: draft.mimeType, data: draft.data }, { timeoutMs: UPLOAD_TIMEOUT_MS })
        .then(
          (result) => patch(draft.key, { status: "ready", upload: result, error: null }),
          (error: unknown) => patch(draft.key, { status: "error", error: describeError(error) }),
        );
    },
    [client, patch],
  );

  const add = useCallback(
    (files: FileData[]) => {
      const now = Date.now();
      const added = files.map<DraftAttachment>((file, index) => ({
        key: draftKey(index, now),
        name: file.name,
        mimeType: mimeTypeOf(file.mimeType),
        size: file.size,
        kind: uploadKindOf(mimeTypeOf(file.mimeType)),
        status: "uploading",
        upload: null,
        error: null,
        data: file.base64,
        previewUrl: previewFor(file),
      }));
      setDrafts((current) => [...current, ...added]);
      added.forEach(upload);
    },
    [upload],
  );

  const full = () => draftsRef.current.length >= LIMITS.maxRunAttachments;

  const attach = useCallback(
    (kind: AttachKind) => {
      if (!enabled) return;
      if (full()) {
        toast(tooManyMessage());
        return;
      }
      if (kind === "paste") {
        void (async () => {
          try {
            if (!(await ipc.attachments.clipboardHasImage())) {
              toast(ATTACHMENT_LABELS.emptyClipboard);
              return;
            }
            const image = await ipc.attachments.pasteImage();
            if (image) add([{ ...image, mimeType: image.mimeType || PNG_MIME_TYPE }]);
            else toast(ATTACHMENT_LABELS.emptyClipboard);
          } catch (error) {
            toast(formatLabel(ATTACHMENT_LABELS.unreadable, { name: ATTACHMENT_LABELS.paste, error: describeError(error) }));
          }
        })();
        return;
      }
      void (async () => {
        try {
          const picked = await ipc.attachments.pick(kind);
          const { accepted, message } = admitFiles(picked, draftsRef.current.length);
          if (message) toast(message);
          const read: FileData[] = [];
          for (const file of accepted) {
            try {
              read.push(await ipc.attachments.read(file.path));
            } catch (error) {
              toast(formatLabel(ATTACHMENT_LABELS.unreadable, { name: file.name, error: describeError(error) }));
            }
          }
          if (read.length > 0) add(read);
        } catch (error) {
          toast(describeError(error));
        }
      })();
    },
    [add, enabled],
  );

  const dropFiles = useCallback(
    (files: File[]) => {
      if (!enabled) return;
      const { accepted, message } = admitFiles(files, draftsRef.current.length);
      if (message) toast(message);
      void Promise.all(
        accepted.map(async (file) => {
          try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            return { name: file.name, mimeType: file.type, size: file.size, base64: bytesToBase64(bytes) };
          } catch (error) {
            toast(formatLabel(ATTACHMENT_LABELS.unreadable, { name: file.name, error: describeError(error) }));
            return null;
          }
        }),
      ).then((results) => {
        const read = results.filter((result): result is FileData => result !== null);
        if (read.length > 0) add(read);
      });
    },
    [add, enabled],
  );

  const remove = useCallback((key: string) => setDrafts((current) => current.filter((draft) => draft.key !== key)), []);

  const retry = useCallback(
    (key: string) => {
      const draft = draftsRef.current.find((entry) => entry.key === key);
      if (!draft) return;
      patch(key, { status: "uploading", error: null });
      upload(draft);
    },
    [patch, upload],
  );

  const clear = useCallback(() => setDrafts([]), []);

  return useMemo(
    () => ({
      drafts,
      hasItems: drafts.length > 0,
      blocked: isBlocked(drafts),
      uploadIds: uploadIds(drafts),
      attach,
      dropFiles,
      remove,
      retry,
      clear,
      prompt: (text: string) => promptWithAttachments(text, drafts),
    }),
    [drafts, attach, dropFiles, remove, retry, clear],
  );
}
