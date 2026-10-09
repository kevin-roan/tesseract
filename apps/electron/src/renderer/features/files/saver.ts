import type { FetchLike, TesseractClient } from "@tesseract/client";
import { ipcFetch } from "../../app/data";
import { bridge, isFixtureMode } from "../../app/runtime";
import { ipc } from "../../lib/ipc";
import { fixtureFetch } from "../../fixtures/fetch";
import type { FileHandoff } from "../../../shared/contracts/files";
import { downloadUrl, runDownload, type DownloadSource, type FileSaver, type SaveTarget } from "./download";
import { ARTIFACT_LABELS } from "./labels";

interface WritableFile {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

interface SaveFileHandle {
  name: string;
  createWritable(): Promise<WritableFile>;
}

type SaveFilePicker = (options: { suggestedName: string }) => Promise<SaveFileHandle>;

export class SaveUnavailableError extends Error {
  constructor() {
    super(ARTIFACT_LABELS.saveUnavailable);
    this.name = "SaveUnavailableError";
  }
}

function picker(): SaveFilePicker | null {
  const candidate = (globalThis as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  return typeof candidate === "function" ? candidate.bind(globalThis) : null;
}

function isCancel(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function chooseSaveTarget(suggestedName: string): Promise<SaveTarget | null> {
  const show = picker();
  if (!show) throw new SaveUnavailableError();
  let handle: SaveFileHandle;
  try {
    handle = await show({ suggestedName });
  } catch (error) {
    if (isCancel(error)) return null;
    throw error;
  }
  const writable = await handle.createWritable();
  return {
    name: handle.name,
    write: (data) => writable.write(data),
    commit: () => writable.close(),
    discard: () => writable.abort(),
  };
}

export function downloadFetch(): FetchLike {
  return isFixtureMode() ? fixtureFetch : ipcFetch;
}

function mainProcessSaver(client: TesseractClient): FileSaver {
  return async (request, callbacks) => {
    const id = crypto.randomUUID();
    let started = false;
    const stop = ipc.files.on("progress", (progress) => {
      if (progress.id !== id) return;
      if (!started) {
        started = true;
        callbacks.onStart();
      }
      if (progress.total) callbacks.onProgress(Math.min(1, progress.received / progress.total));
    });
    try {
      const saved = await ipc.files.download(id, {
        url: downloadUrl(client, request.source),
        headers: client.authHeaders(),
        suggestedName: request.suggestedName,
        expectedSha256: request.expectedSha256,
        useHeaderChecksum: true,
      });
      return saved?.name ?? null;
    } finally {
      stop();
    }
  };
}

export function canHandOff(): boolean {
  return !isFixtureMode() && bridge() !== null;
}

/** Downloads into a temp folder in the main process, then shares (macOS) or opens it with the default app. */
export async function handOffFile(client: TesseractClient, source: DownloadSource, suggestedName: string, mode: FileHandoff): Promise<string> {
  if (!canHandOff()) throw new SaveUnavailableError();
  const saved = await ipc.files.handoff(crypto.randomUUID(), {
    url: downloadUrl(client, source),
    headers: client.authHeaders(),
    suggestedName,
    expectedSha256: null,
    useHeaderChecksum: true,
  }, mode);
  return saved.name;
}

export function rendererFileSaver(client: TesseractClient): FileSaver {
  if (!isFixtureMode() && bridge()) return mainProcessSaver(client);
  return async (request, callbacks) => {
    const target = await chooseSaveTarget(request.suggestedName);
    if (!target) return null;
    callbacks.onStart();
    return runDownload({
      url: downloadUrl(client, request.source),
      headers: client.authHeaders(),
      fetch: downloadFetch(),
      target,
      expectedSha256: request.expectedSha256,
    });
  };
}
