import { open, stat } from "node:fs/promises";
import { basename } from "node:path";
import type { AttachmentFileData, PickedFile } from "../../shared/contracts/attachments";
import { MAX_UPLOAD_BYTES, PNG_MIME_TYPE, READ_CHUNK_BYTES } from "./constants";
import { ATTACHMENT_LABELS } from "./labels";
import { mimeTypeOf, pastedImageName, tooLargeMessage } from "./model";

export class AttachmentError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AttachmentError";
  }
}

export interface ReadOptions {
  maxBytes?: number;
}

async function readCapped(path: string, limit: number): Promise<Buffer> {
  const handle = await open(path, "r");
  try {
    const chunks: Buffer[] = [];
    let total = 0;
    while (total <= limit) {
      const buffer = Buffer.allocUnsafe(Math.min(limit + 1 - total, READ_CHUNK_BYTES));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      chunks.push(buffer.subarray(0, bytesRead));
      total += bytesRead;
    }
    return Buffer.concat(chunks);
  } finally {
    await handle.close();
  }
}

export function attachmentData(name: string, mimeType: string, data: Uint8Array, limit = MAX_UPLOAD_BYTES): AttachmentFileData {
  if (data.length > limit) throw new AttachmentError(tooLargeMessage(name, limit));
  return { name, mimeType, size: data.length, base64: Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("base64") };
}

export async function readAttachment(path: string, options: ReadOptions = {}): Promise<AttachmentFileData> {
  const name = basename(path);
  const limit = options.maxBytes ?? MAX_UPLOAD_BYTES;
  let data: Buffer;
  try {
    data = await readCapped(path, limit);
  } catch (error) {
    throw new AttachmentError(error instanceof Error ? error.message : String(error), { cause: error });
  }
  return attachmentData(name, mimeTypeOf(name), data, limit);
}

export async function pickedFile(path: string): Promise<PickedFile> {
  const size = await stat(path).then((info) => info.size, () => 0);
  return { path, name: basename(path), size };
}

export function pastedImage(png: Uint8Array, nowMs = Date.now()): AttachmentFileData {
  return attachmentData(pastedImageName(nowMs), PNG_MIME_TYPE, png);
}

export function pasteFailedMessage(error: unknown): string {
  return ATTACHMENT_LABELS.unreadable(ATTACHMENT_LABELS.paste, error instanceof Error ? error.message : String(error));
}
