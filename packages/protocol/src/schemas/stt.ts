import { z } from "zod";
import { STT_ENGINE_NAMES, STT_PROFILES, STT_PROVIDERS } from "../constants";

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
  /** Whether `provider: "gemini"` can be tried (GEMINI_API_KEY is set) and the model it uses. */
  gemini: z.object({ configured: z.boolean(), model: z.string() }),
});
export type SttStatus = z.infer<typeof SttStatusSchema>;

export const UpdateSttSchema = z.object({ profile: SttProfileSchema });
export type UpdateStt = z.infer<typeof UpdateSttSchema>;
