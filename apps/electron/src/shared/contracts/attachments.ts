import type { DefineContract } from "../ipc-types";

export type AttachmentPickKind = "images" | "files";

export interface PickedFile {
  path: string;
  name: string;
  size: number;
}

export interface AttachmentFileData {
  name: string;
  mimeType: string;
  size: number;
  base64: string;
}

export type AttachmentsContract = DefineContract<{
  methods: {
    pick(kind: AttachmentPickKind): PickedFile[];
    read(path: string): AttachmentFileData;
    clipboardHasImage(): boolean;
    clipboardHasText(): boolean;
    pasteImage(): AttachmentFileData | null;
  };
  events: Record<never, never>;
}>;
