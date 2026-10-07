import type { UploadKind } from "@theone/protocol";
import {
  BYTE_STEP,
  BYTE_UNITS,
  FALLBACK_MIME_TYPE,
  FALLBACK_UPLOAD_NAME,
  AUDIO_MIME_PREFIX,
  IMAGE_MIME_PREFIX,
  MAX_NAME_LENGTH,
  MAX_UPLOAD_BYTES,
  MIME_TYPES,
  PDF_MIME_TYPE,
  WHOLE_UNIT_FROM,
} from "./constants";
import { ATTACHMENT_LABELS } from "./labels";

export function uploadKindOf(mimeType: string): UploadKind {
  if (mimeType.startsWith(IMAGE_MIME_PREFIX)) return "image";
  if (mimeType.startsWith(AUDIO_MIME_PREFIX)) return "audio";
  if (mimeType === PDF_MIME_TYPE) return "pdf";
  return "file";
}

export function mimeTypeOf(name: string, hint?: string | null): string {
  const trimmed = hint?.trim();
  if (trimmed && trimmed.includes("/")) return trimmed;
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return FALLBACK_MIME_TYPE;
  return MIME_TYPES[name.slice(dot + 1).toLowerCase()] ?? FALLBACK_MIME_TYPE;
}

export function uploadName(name: string): string {
  return name.trim().slice(0, MAX_NAME_LENGTH) || FALLBACK_UPLOAD_NAME;
}

export function pastedImageName(nowMs: number): string {
  return `pasted-image-${Math.floor(nowMs).toString(16)}.png`;
}

function jsFixed(value: number, digits: number): string {
  const factor = 10 ** digits;
  return (Math.floor(value * factor + 0.5) / factor).toFixed(digits);
}

export function formatBytes(size: number | null | undefined): string {
  if (size === null || size === undefined || !Number.isFinite(size) || size <= 0) return `0 ${BYTE_UNITS[0]}`;
  let value = size;
  let unit = 0;
  while (value >= BYTE_STEP && unit < BYTE_UNITS.length - 1) {
    value /= BYTE_STEP;
    unit += 1;
  }
  if (unit === 0) return `${Math.round(value)} ${BYTE_UNITS[0]}`;
  const fixed = value >= WHOLE_UNIT_FROM ? jsFixed(value, 0) : jsFixed(value, 1);
  return `${fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed} ${BYTE_UNITS[unit]}`;
}

export function tooLargeMessage(name: string, limit = MAX_UPLOAD_BYTES): string {
  return ATTACHMENT_LABELS.tooLarge(name, formatBytes(limit));
}
