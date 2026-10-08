import { LIMITS, type Upload, type UploadKind } from "@tesseract/protocol";
import { DRAFT_KEY_RANDOM_CHARS, FALLBACK_MIME_TYPE, UPLOAD_FALLBACK_NAME } from "./constants";
import { formatBytes } from "./format";
import { ATTACHMENT_LABELS, formatLabel } from "./labels";

export type DraftStatus = "uploading" | "ready" | "error";

export interface DraftAttachment {
  key: string;
  name: string;
  mimeType: string;
  size: number;
  kind: UploadKind;
  status: DraftStatus;
  upload: Upload | null;
  error: string | null;
  data: string;
  previewUrl: string | null;
}

export interface CandidateFile {
  name: string;
  size: number | null;
}

export function uploadKindOf(mimeType: string): UploadKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  return "file";
}

export function mimeTypeOf(hint: string | null | undefined): string {
  const trimmed = (hint ?? "").trim();
  return trimmed.includes("/") ? trimmed : FALLBACK_MIME_TYPE;
}

export function uploadName(name: string): string {
  return name.trim().slice(0, LIMITS.maxUploadNameLength) || UPLOAD_FALLBACK_NAME;
}

export function draftKey(index: number, now: number = Date.now(), random: () => number = Math.random): string {
  const suffix = Math.floor(random() * 16 ** DRAFT_KEY_RANDOM_CHARS)
    .toString(16)
    .padStart(DRAFT_KEY_RANDOM_CHARS, "0");
  return `att-${now.toString(16)}-${index}-${suffix}`;
}

export function tooLargeMessage(name: string): string {
  return formatLabel(ATTACHMENT_LABELS.tooLarge, { name, limit: formatBytes(LIMITS.maxUploadBytes) });
}

export function tooManyMessage(): string {
  return formatLabel(ATTACHMENT_LABELS.tooMany, { limit: LIMITS.maxRunAttachments });
}

export function admitFiles<T extends CandidateFile>(files: readonly T[], current: number): { accepted: T[]; message: string | null } {
  const messages: string[] = [];
  const sized = files.filter((file) => {
    if (file.size !== null && file.size > LIMITS.maxUploadBytes) {
      messages.push(tooLargeMessage(file.name));
      return false;
    }
    return true;
  });
  const slots = Math.max(0, LIMITS.maxRunAttachments - current);
  if (sized.length > slots) messages.push(tooManyMessage());
  return { accepted: sized.slice(0, slots), message: messages.length > 0 ? messages.join(" ") : null };
}

export function uploadIds(drafts: readonly DraftAttachment[]): string[] {
  return drafts.flatMap((draft) => (draft.status === "ready" && draft.upload ? [draft.upload.id] : []));
}

export function isBlocked(drafts: readonly DraftAttachment[]): boolean {
  return drafts.some((draft) => draft.status !== "ready");
}

export function promptWithAttachments(text: string, drafts: readonly DraftAttachment[]): string {
  const trimmed = text.trim();
  if (trimmed || drafts.length === 0) return trimmed;
  const images = drafts.every((draft) => draft.kind === "image");
  if (images) return drafts.length === 1 ? ATTACHMENT_LABELS.promptImage : ATTACHMENT_LABELS.promptImages;
  return drafts.length === 1 ? ATTACHMENT_LABELS.promptFile : ATTACHMENT_LABELS.promptFiles;
}

export { bytesToBase64 } from "../../lib/base64";
