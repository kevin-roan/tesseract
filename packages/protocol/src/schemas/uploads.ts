import { z } from "zod";
import { LIMITS, UPLOAD_KINDS } from "../constants";
import { ByteCountSchema, TimestampSchema, UploadIdSchema } from "./primitives";
import { SttProviderSchema } from "./stt";

export const UploadKindSchema = z.enum(UPLOAD_KINDS);
export type UploadKind = z.infer<typeof UploadKindSchema>;

export const UploadSchema = z.object({
  id: UploadIdSchema,
  name: z.string(),
  mimeType: z.string(),
  kind: UploadKindSchema,
  sizeBytes: ByteCountSchema,
  /** Absolute path inside the sandbox; agent runs read attachments from here. */
  path: z.string(),
  createdAt: TimestampSchema,
});
export type Upload = z.infer<typeof UploadSchema>;

export const CreateUploadSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.maxUploadNameLength),
  mimeType: z.string().trim().min(1).max(255),
  /** Standard base64 of the file bytes (at most `LIMITS.maxUploadBytes` once decoded). */
  data: z.string().min(1),
});
export type CreateUpload = z.infer<typeof CreateUploadSchema>;

export const CreateTranscriptionSchema = z.object({
  uploadId: UploadIdSchema,
  /** ISO-639-1 hint such as "en"; omitted means auto-detect. */
  language: z.string().trim().min(2).max(LIMITS.maxTranscriptionLanguageLength).optional(),
  /** Omitted means "native". "gemini" falls back to native when Gemini is not configured or fails. */
  provider: SttProviderSchema.optional(),
});
export type CreateTranscription = z.infer<typeof CreateTranscriptionSchema>;

export const TranscriptionSchema = z.object({
  uploadId: UploadIdSchema,
  text: z.string(),
  language: z.string().nullable(),
  durationMs: z.int().nonnegative().nullable(),
  /** Which backend produced the text, e.g. "whisper.cpp" or "openai-compatible". */
  engine: z.string(),
  /** Why Gemini was skipped and the native engine answered instead; null otherwise. */
  fallbackReason: z.string().nullable(),
});
export type Transcription = z.infer<typeof TranscriptionSchema>;
