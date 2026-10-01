import type { UploadKind } from "@theone/protocol";

import type { AttachSource, DraftAttachment, PickedFile } from "../types";
import { FALLBACK_MIME_TYPE, MAX_ATTACHMENTS, MAX_UPLOAD_BYTES } from "./constants";

const UNITS = ["B", "KB", "MB", "GB"] as const;

export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(value < 10 ? 1 : 0)} ${UNITS[unit]}`;
}

export function uploadKindOf(mimeType: string): UploadKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  return "file";
}

export function fileNameOf(uri: string, fallback: string): string {
  const last = uri.split(/[?#]/)[0]?.split("/").pop();
  return last ? decodeURIComponent(last) : fallback;
}

export function mimeTypeOr(mimeType: string | null | undefined): string {
  return mimeType?.trim() ? mimeType : FALLBACK_MIME_TYPE;
}

export function isTooLarge(file: PickedFile): boolean {
  return file.sizeBytes !== null && file.sizeBytes > MAX_UPLOAD_BYTES;
}

export function tooLargeMessage(name: string): string {
  return `${name} is larger than ${formatBytes(MAX_UPLOAD_BYTES)}.`;
}

export function remainingSlots(current: number): number {
  return Math.max(0, MAX_ATTACHMENTS - current);
}

export function tooManyMessage(): string {
  return `You can attach up to ${MAX_ATTACHMENTS} files to one message.`;
}

export type AdmitResult = { accepted: PickedFile[]; rejected: string[] };

export function admitFiles(files: PickedFile[], current: number): AdmitResult {
  const rejected: string[] = [];
  const sized = files.filter((file) => {
    if (!isTooLarge(file)) return true;
    rejected.push(tooLargeMessage(file.name));
    return false;
  });
  const slots = remainingSlots(current);
  if (sized.length > slots) rejected.push(tooManyMessage());
  return { accepted: sized.slice(0, slots), rejected };
}

export function defaultPromptFor(attachments: Pick<DraftAttachment, "kind">[]): string {
  const images = attachments.filter((item) => item.kind === "image").length;
  if (images === attachments.length) {
    return images === 1 ? "Take a look at this image." : "Take a look at these images.";
  }
  return attachments.length === 1 ? "Take a look at the attached file." : "Take a look at the attached files.";
}

export function draftKey(source: AttachSource | "voice", index: number): string {
  return `${source}-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

export function decodedLength(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function base64FromDataUrl(value: string): string {
  return value.startsWith("data:") ? value.slice(value.indexOf(",") + 1) : value;
}

export function pastedImageName(): string {
  return `pasted-image-${Date.now().toString(36)}.png`;
}
