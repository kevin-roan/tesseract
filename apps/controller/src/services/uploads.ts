import { mkdirSync, rmSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createId, LIMITS, type CreateUpload, type Upload, type UploadKind } from "@tesseract/protocol";
import { badRequest, notFound } from "../core/errors";
import { isInside, realpathOrNull } from "../core/paths";
import { nowIso } from "../core/time";
import type { Logger } from "../core/logger";
import type { Repositories } from "../db/repositories";
import type { Config } from "../config";

export const UPLOAD_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const BASE64_PATTERN = /^[A-Za-z0-9+/]*$/;
const MIME_PATTERN = /^[a-z0-9][\w.+-]*\/[\w.+-]+$/;
const EXTENSION_PATTERN = /\.[A-Za-z0-9]{1,16}$/;
const MAX_NAME_BYTES = 200;
const FALLBACK_NAME = "upload";
const MIB = 1024 * 1024;

/** Decodes standard base64 (padding optional, whitespace ignored) without exceeding `maxBytes`. */
export function decodeBase64(data: string, maxBytes: number): Uint8Array {
  const digits = data.replace(/\s+/g, "").replace(/={1,2}$/, "");
  if (!BASE64_PATTERN.test(digits) || digits.length % 4 === 1) throw badRequest("data must be standard base64");
  const size = Math.floor((digits.length * 3) / 4);
  if (size > maxBytes) throw badRequest(`File exceeds ${Math.floor(maxBytes / MIB)} MiB`);
  if (size === 0) throw badRequest("File is empty");
  return Buffer.from(digits, "base64");
}

function truncateBytes(value: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  let result = "";
  let bytes = 0;
  for (const char of value) {
    bytes += encoder.encode(char).length;
    if (bytes > maxBytes) break;
    result += char;
  }
  return result;
}

/** Last path segment without control characters or leading dots, at most 200 UTF-8 bytes (the extension is kept). */
export function sanitizeFileName(input: string): string {
  const base = input.split(/[/\\]/).pop() ?? "";
  const cleaned = base.replace(/[\x00-\x1f\x7f]/g, "").replace(/^[\s.]+/, "").trim();
  if (!cleaned) return FALLBACK_NAME;
  const extension = EXTENSION_PATTERN.exec(cleaned)?.[0] ?? "";
  const stem = cleaned.slice(0, cleaned.length - extension.length);
  const name = `${truncateBytes(stem, MAX_NAME_BYTES - extension.length).trim()}${extension}`;
  return name.replace(/^[\s.]+/, "") || FALLBACK_NAME;
}

export function normalizeMimeType(input: string): string {
  const essence = (input.split(";")[0] ?? "").trim().toLowerCase();
  return MIME_PATTERN.test(essence) ? essence : "application/octet-stream";
}

export function uploadKind(mimeType: string): UploadKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("audio/")) return "audio";
  return "file";
}

export class UploadService {
  constructor(
    private readonly config: Config,
    private readonly repos: Repositories,
    private readonly logger: Logger,
  ) {}

  get root(): string {
    return this.config.uploadsDir;
  }

  async create(input: CreateUpload): Promise<Upload> {
    const bytes = decodeBase64(input.data, LIMITS.maxUploadBytes);
    const mimeType = normalizeMimeType(input.mimeType);
    const id = createId("upload");
    const name = sanitizeFileName(input.name);
    const path = join(this.root, id, name);
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, bytes, { mode: 0o600, flag: "wx" });
    const upload: Upload = { id, name, mimeType, kind: uploadKind(mimeType), sizeBytes: bytes.length, path, createdAt: nowIso() };
    this.repos.uploads.save(upload);
    this.logger.info("upload stored", { id, kind: upload.kind, bytes: upload.sizeBytes });
    return upload;
  }

  get(id: string): Upload {
    const upload = this.repos.uploads.get(id);
    if (!upload) throw notFound(`Upload ${id} not found`);
    return upload;
  }

  /** In the given order without duplicates; the first unknown id is a 404. */
  resolve(ids: readonly string[]): Upload[] {
    return [...new Set(ids)].map((id) => this.get(id));
  }

  /** Refuses rows whose file was removed or no longer resolves inside the uploads directory. */
  content(id: string): { upload: Upload; path: string } {
    const upload = this.get(id);
    const root = realpathOrNull(this.root);
    const real = realpathOrNull(upload.path);
    if (!root || !real || !isInside(root, real) || !statSync(real).isFile()) {
      throw notFound(`Upload file ${upload.name} is no longer available`);
    }
    return { upload, path: real };
  }

  /** Deletes uploads (rows and files) older than `maxAgeMs`; returns how many were removed. */
  prune(maxAgeMs: number = UPLOAD_RETENTION_MS): number {
    const removed = this.repos.deleteUploadsBefore(new Date(Date.now() - maxAgeMs).toISOString());
    for (const upload of removed) {
      const dir = dirname(upload.path);
      if (dirname(dir) === this.root) rmSync(dir, { recursive: true, force: true });
    }
    if (removed.length > 0) this.logger.info("pruned old uploads", { count: removed.length });
    return removed.length;
  }
}
