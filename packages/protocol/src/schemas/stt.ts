import { z } from "zod";
import { GEMINI_KEY_SOURCES, STT_ENGINE_NAMES, STT_PROFILES, STT_PROVIDERS } from "../constants";

export const SttProfileSchema = z.enum(STT_PROFILES);
export type SttProfile = z.infer<typeof SttProfileSchema>;

export const SttProviderSchema = z.enum(STT_PROVIDERS);
export type SttProvider = z.infer<typeof SttProviderSchema>;

export const SttEngineNameSchema = z.enum(STT_ENGINE_NAMES);
export type SttEngineName = z.infer<typeof SttEngineNameSchema>;

export const SttProfileInfoSchema = z.object({
  id: SttProfileSchema,
  /** ggml model name such as "base" or "small"; null for "off". */
  model: z.string().nullable(),
  threads: z.int().nonnegative(),
  nice: z.int().min(0).max(19),
  /** The profile's own model file is installed (always true for "off"). */
  available: z.boolean(),
});
export type SttProfileInfo = z.infer<typeof SttProfileInfoSchema>;

export const SttStatusSchema = z.object({
  profile: SttProfileSchema,
  /** All profiles, in `STT_PROFILES` order. */
  profiles: z.array(SttProfileInfoSchema),
  /** The engine a transcription would use now; null when none would run. */
  engine: SttEngineNameSchema.nullable(),
  ready: z.boolean(),
  /** Why a transcription would not run now; null when ready. */
  reason: z.string().nullable(),
  /** The model a transcription would use now, after falling back from a missing profile model. */
  model: z.string().nullable(),
  /** CPUs the controller may use (cgroup quota applied). */
  cpus: z.int().positive(),
  busy: z.boolean(),
  queued: z.int().nonnegative(),
  /** Whether `provider: "gemini"` can be tried (a key is set) and the model it uses. The key itself is never returned. */
  gemini: z.object({
    configured: z.boolean(),
    model: z.string(),
    /** Where the key in use comes from; null when there is none. */
    source: z.enum(GEMINI_KEY_SOURCES).nullable(),
  }),
});
export type SttStatus = z.infer<typeof SttStatusSchema>;

/** A Gemini API key as pasted into an app: printable ASCII without spaces. */
export const GeminiApiKeySchema = z
  .string()
  .trim()
  .min(1, "The Gemini API key must not be empty")
  .max(256, "The Gemini API key is too long")
  .regex(/^[\x21-\x7e]+$/, "The Gemini API key must not contain spaces or special characters");

/** Any subset of the fields; `geminiApiKey: null` forgets the saved key. */
export const UpdateSttSchema = z
  .object({ profile: SttProfileSchema.optional(), geminiApiKey: GeminiApiKeySchema.nullable().optional() })
  .refine((body) => body.profile !== undefined || body.geminiApiKey !== undefined, "Nothing to update");
export type UpdateStt = z.infer<typeof UpdateSttSchema>;
