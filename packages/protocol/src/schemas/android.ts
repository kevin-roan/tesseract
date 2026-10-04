import { z } from "zod";
import { ANDROID_KEYS, ANDROID_TOUCH_ACTIONS, AVD_NAME_PATTERN, EMULATOR_ISOLATION_MODES, EMULATOR_STATES, LIMITS } from "../constants";
import { AdbStreamIdSchema, TimestampSchema } from "./primitives";

export const EmulatorStateSchema = z.enum(EMULATOR_STATES);
export type EmulatorState = z.infer<typeof EmulatorStateSchema>;

export const EmulatorIsolationModeSchema = z.enum(EMULATOR_ISOLATION_MODES);
export type EmulatorIsolationMode = z.infer<typeof EmulatorIsolationModeSchema>;

/**
 * `managed: false` for an emulator the host daemon adopted rather than started;
 * `isolated: true` only for one running in its own network namespace (netns runtime dir).
 */
export const EmulatorInfoSchema = z.object({
  state: EmulatorStateSchema,
  avd: z.string().nullable(),
  serial: z.string().nullable(),
  managed: z.boolean(),
  isolated: z.boolean(),
  width: z.int().positive().nullable(),
  height: z.int().positive().nullable(),
  startedAt: TimestampSchema.nullable(),
  error: z.string().nullable(),
});
export type EmulatorInfo = z.infer<typeof EmulatorInfoSchema>;

export const AndroidLinkInfoSchema = z.object({
  configured: z.boolean(),
  sandboxUrl: z.string().nullable(),
  connected: z.boolean(),
  lastError: z.string().nullable(),
});
export type AndroidLinkInfo = z.infer<typeof AndroidLinkInfoSchema>;

/** `GET /v1/android` of the host daemon; a missing tool gives `available: false` and a `reason`. */
export const HostAndroidStatusSchema = z.object({
  available: z.boolean(),
  reason: z.string().nullable(),
  sdkRoot: z.string().nullable(),
  /** `THEONE_EMULATOR_ISOLATION` of the host daemon; `none` lets the guest reach the host network. */
  isolation: EmulatorIsolationModeSchema,
  avds: z.array(z.string()),
  scrcpy: z.boolean(),
  ffmpeg: z.boolean(),
  emulator: EmulatorInfoSchema,
  link: AndroidLinkInfoSchema,
});
export type HostAndroidStatus = z.infer<typeof HostAndroidStatusSchema>;

export const AvdNameSchema = z.string().regex(AVD_NAME_PATTERN, "Invalid AVD name");

export const StartEmulatorSchema = z.object({
  avd: AvdNameSchema,
  coldBoot: z.boolean().optional(),
  wipeData: z.boolean().optional(),
});
export type StartEmulator = z.infer<typeof StartEmulatorSchema>;

export const LinkSandboxSchema = z.object({
  sandboxUrl: z.url({ protocol: /^https?$/, error: "The sandbox URL must be an http or https URL" }).refine((value) => {
    const url = new URL(value);
    return url.username === "" && url.password === "" && url.hash === "";
  }, "The sandbox URL must not contain credentials or a fragment"),
  token: z.string().min(1),
});
export type LinkSandbox = z.infer<typeof LinkSandboxSchema>;

/** `GET /v1/android` of the controller. */
export const SandboxAndroidStatusSchema = z.object({
  linked: z.boolean(),
  hostId: z.string().nullable(),
  emulator: EmulatorInfoSchema.nullable(),
  adbSerial: z.string().nullable(),
  adbConnected: z.boolean(),
});
export type SandboxAndroidStatus = z.infer<typeof SandboxAndroidStatusSchema>;

/** Host → sandbox text frames on `/v1/android/link`. */
export const AndroidLinkHostMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), hostId: z.string(), version: z.string() }),
  z.object({ type: z.literal("emulator"), emulator: EmulatorInfoSchema }),
  z.object({ type: z.literal("refuse"), streamId: AdbStreamIdSchema, message: z.string() }),
  z.object({ type: z.literal("pong") }),
]);
export type AndroidLinkHostMessage = z.infer<typeof AndroidLinkHostMessageSchema>;

/** Sandbox → host text frames on `/v1/android/link`. */
export const AndroidLinkSandboxMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("open"), streamId: AdbStreamIdSchema }),
  z.object({ type: z.literal("ping") }),
]);
export type AndroidLinkSandboxMessage = z.infer<typeof AndroidLinkSandboxMessageSchema>;

export const AndroidKeySchema = z.enum(ANDROID_KEYS);
export type AndroidKey = z.infer<typeof AndroidKeySchema>;

const ScreenSizeSchema = z.int().positive();
const ScreenPointSchema = {
  x: z.number(),
  y: z.number(),
  width: ScreenSizeSchema,
  height: ScreenSizeSchema,
};
const ScrollSchema = z.number().min(-LIMITS.maxAndroidScroll).max(LIMITS.maxAndroidScroll);

/** Client → daemon text frames on `/v1/android/screen`; `x,y` are in the client's `width × height` space. */
export const AndroidScreenClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("touch"),
    action: z.enum(ANDROID_TOUCH_ACTIONS),
    pointerId: z.int().min(0).max(LIMITS.maxAndroidPointerId),
    ...ScreenPointSchema,
    pressure: z.number().min(0).max(1),
  }),
  z.object({ type: z.literal("scroll"), ...ScreenPointSchema, hscroll: ScrollSchema, vscroll: ScrollSchema }),
  z.object({ type: z.literal("key"), key: AndroidKeySchema }),
  /** At most 300 characters; the host truncates to scrcpy's limit of 300 UTF-8 bytes. */
  z.object({ type: z.literal("text"), text: z.string().min(1).max(LIMITS.maxAndroidTextLength) }),
  z.object({ type: z.literal("rotate") }),
]);
export type AndroidScreenClientMessage = z.infer<typeof AndroidScreenClientMessageSchema>;

/** Daemon → client text frames on `/v1/android/screen`; JPEG frames are binary messages. */
export const AndroidScreenServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("meta"), deviceName: z.string(), width: ScreenSizeSchema, height: ScreenSizeSchema }),
  z.object({ type: z.literal("size"), width: ScreenSizeSchema, height: ScreenSizeSchema }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type AndroidScreenServerMessage = z.infer<typeof AndroidScreenServerMessageSchema>;

export const AndroidScreenQuerySchema = z.object({
  ticket: z.string().min(1),
  maxSize: z.coerce.number<string | number | undefined>().int().min(1).max(LIMITS.maxAndroidScreenSize).optional(),
});
export type AndroidScreenQuery = z.infer<typeof AndroidScreenQuerySchema>;
