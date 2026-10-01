import type { Upload, UploadKind } from "@theone/protocol";

export type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number | null;
};

export type AttachmentStatus = "uploading" | "ready" | "error";

export type DraftAttachment = PickedFile & {
  key: string;
  kind: UploadKind;
  status: AttachmentStatus;
  upload: Upload | null;
  error: string | null;
};

export type PickerSource = "library" | "camera" | "files" | "clipboard";

/** `capture` and `share` arrive through the island (screen capture, share sheet) instead of a picker. */
export type AttachSource = PickerSource | "capture" | "share";
