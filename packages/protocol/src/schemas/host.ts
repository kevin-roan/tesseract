import { z } from "zod";
import { HOST_PIN_PATTERN, HOST_SHELL_SERVICE, PROTOCOL_VERSION } from "../constants";
import { TimestampSchema } from "./primitives";
import { CreateTerminalSchema } from "./processes";

/** `GET /v1/health` of the host shell daemon (`tesseract-controller host serve`). */
export const HostHealthSchema = z.object({
  ok: z.literal(true),
  service: z.literal(HOST_SHELL_SERVICE),
  version: z.string(),
  protocolVersion: z.literal(PROTOCOL_VERSION),
  hostId: z.string(),
});
export type HostHealth = z.infer<typeof HostHealthSchema>;

export const HostPinSchema = z.string().regex(HOST_PIN_PATTERN, "The PIN must be 6 to 12 digits");

/** `GET /v1/host/lock`: whether a PIN is set and how many wrong PINs are left before a lockout. */
export const HostLockStatusSchema = z.object({
  pinSet: z.boolean(),
  attemptsLeft: z.int().nonnegative(),
  lockedUntil: TimestampSchema.nullable(),
});
export type HostLockStatus = z.infer<typeof HostLockStatusSchema>;

export const HostUnlockSchema = z.object({ pin: HostPinSchema });
export type HostUnlock = z.infer<typeof HostUnlockSchema>;

/** Bearer token for the host's terminal routes; held in memory by the phone only. */
export const HostSessionSchema = z.object({
  session: z.string().min(1),
  expiresAt: TimestampSchema,
});
export type HostSession = z.infer<typeof HostSessionSchema>;

export const HostLockSchema = z.object({ session: z.string().min(1) });
export type HostLock = z.infer<typeof HostLockSchema>;

/** `POST /v1/terminals` on the host shell; `cwd` is an absolute host folder (a project's host copy) and defaults to the home folder. */
export const CreateHostTerminalSchema = CreateTerminalSchema.extend({
  cwd: z.string().min(1).max(4096).optional(),
});
export type CreateHostTerminal = z.infer<typeof CreateHostTerminalSchema>;
