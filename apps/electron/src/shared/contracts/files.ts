import type { DefineContract } from "../ipc-types";

export interface FileDownloadRequest {
  url: string;
  headers: Record<string, string>;
  suggestedName: string;
  expectedSha256: string | null;
  useHeaderChecksum: boolean;
}

export type FileHandoff = "share" | "open";

export interface FileSaveResult {
  path: string;
  name: string;
}

export interface FileProgress {
  id: string;
  received: number;
  total: number | null;
}

export type FilesContract = DefineContract<{
  methods: {
    download(id: string, request: FileDownloadRequest): FileSaveResult | null;
    /** Downloads to a temp folder, then opens the macOS share menu or the default app. */
    handoff(id: string, request: FileDownloadRequest, mode: FileHandoff): FileSaveResult;
    canShare(): boolean;
    saveBytes(suggestedName: string, dataBase64: string): FileSaveResult | null;
    cancel(id: string): void;
    readClipboard(): string;
    writeClipboard(text: string): void;
  };
  events: {
    progress: FileProgress;
  };
}>;
