import { z } from "zod";
import { HOST_PIN_PATTERN, HOST_SHELL_SERVICE, PROTOCOL_VERSION } from "../constants";
import { TimestampSchema } from "./primitives";
import { DeployContainerNameSchema } from "./deploys";
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

/**
 * `POST /v1/terminals` on the host shell; `cwd` is an absolute host folder (a project's host copy) and defaults to the home folder.
 * `container` opens a root login shell in the server container `tesseract-ct-<container>` on this host instead (kind `shell`, no `cwd`).
 */
export const CreateHostTerminalSchema = CreateTerminalSchema.omit({ resumeSessionId: true, forkSession: true }).extend({
  cwd: z.string().min(1).max(4096).optional(),
  container: DeployContainerNameSchema.optional(),
});
export type CreateHostTerminal = z.infer<typeof CreateHostTerminalSchema>;

/** `GET /v1/host/workspace` on the host shell (needs a session): the host workspace controller and the repositories linked into it. */
export const HostWorkspaceAccessSchema = z.object({
  url: z.string().min(1),
  token: z.string().min(1),
  name: z.string().min(1),
  projects: z.array(z.object({ id: z.string().min(1), path: z.string().min(1) })),
});
export type HostWorkspaceAccess = z.infer<typeof HostWorkspaceAccessSchema>;

/** Header of `POST /v1/host/docker` carrying the JSON `HostDockerSpec`; the request body is the command's stdin. */
export const HOST_DOCKER_SPEC_HEADER = "x-tesseract-docker";
/** Variables a caller may add to the `docker` environment (e.g. the tunnel connector's `TUNNEL_TOKEN`). */
export const HOST_DOCKER_ENV_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

/**
 * `POST /v1/host/docker` on the host shell (needs a session): runs `docker <args>` on the host, so the desktop app can
 * manage the host's server containers. The response is NDJSON `HostDockerMessage`s ending with one `exit`.
 */
export const HostDockerSpecSchema = z.object({
  args: z.array(z.string().max(16_384)).min(1).max(256),
  env: z.record(z.string().regex(HOST_DOCKER_ENV_PATTERN), z.string().max(16_384)).optional(),
  timeoutMs: z.int().positive().max(60 * 60_000).optional(),
});
export type HostDockerSpec = z.infer<typeof HostDockerSpecSchema>;

export const HostDockerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("stdout"), data: z.string() }),
  z.object({ type: z.literal("stderr"), data: z.string() }),
  z.object({ type: z.literal("exit"), code: z.int().nullable(), timedOut: z.boolean() }),
]);
export type HostDockerMessage = z.infer<typeof HostDockerMessageSchema>;
