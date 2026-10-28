import { z } from "zod";
import {
  IOS_APP_SCHEME_PATTERN,
  IOS_INSTALL_STATES,
  IOS_ISOLATION_MODES,
  IOS_KEYS,
  IOS_LINK_REQUEST_STATES,
  IOS_LINK_REQUEST_TYPES,
  IOS_LINK_STAGES,
  IOS_RESERVED_URL_SCHEMES,
  IOS_UNAVAILABLE_CODES,
  LIMITS,
  SHA256_PATTERN,
  SIM_STATES,
  SIM_UDID_PATTERN,
} from "../constants";
import {
  AndroidLinkInfoSchema,
  AndroidScreenClientMessageSchema,
  AndroidScreenServerMessageSchema,
  AndroidStreamEncodingSchema,
  AndroidStreamSettingsSchema,
  type AndroidScreenClientMessage,
  type AndroidScreenServerMessage,
} from "./android";
import { ArtifactIdSchema, ByteCountSchema, IosInstallIdSchema, IosStreamIdSchema, TimestampSchema } from "./primitives";

/**
 * Client → daemon text frames of a device screen socket (`/v1/android/screen`, `/v1/ios/screen`): one protocol, so the
 * viewer page is shared. iOS ignores `rotate`, the keys outside `IOS_KEYS` and every pointer but the first one held down.
 */
export const DeviceScreenClientMessageSchema = AndroidScreenClientMessageSchema;
export type DeviceScreenClientMessage = AndroidScreenClientMessage;
/**
 * Daemon → client text frames of a device screen socket. iOS sends `codec: "h264"` (flags byte + Annex B, as Android) when
 * the viewer asked `codec=h264`, the stream settings allow it and the host has `tesseract-simcap`; else `mjpeg`.
 */
export const DeviceScreenServerMessageSchema = AndroidScreenServerMessageSchema;
export type DeviceScreenServerMessage = AndroidScreenServerMessage;

export const SimStateSchema = z.enum(SIM_STATES);
export type SimState = z.infer<typeof SimStateSchema>;

export const SimUdidSchema = z.string().regex(SIM_UDID_PATTERN, "Invalid simulator UDID");

export const IosUnavailableCodeSchema = z.enum(IOS_UNAVAILABLE_CODES);
export type IosUnavailableCode = z.infer<typeof IosUnavailableCodeSchema>;

export const IosIsolationModeSchema = z.enum(IOS_ISOLATION_MODES);
export type IosIsolationMode = z.infer<typeof IosIsolationModeSchema>;

export const IosKeySchema = z.enum(IOS_KEYS);
export type IosKey = z.infer<typeof IosKeySchema>;

/**
 * One available iOS Simulator device (`xcrun simctl list devices --json`). `runtime` is e.g. `iOS 26.0`. The screen in
 * points and its scale come from `idb describe` once the device is booted (null before, or when idb cannot tell).
 */
export const SimDeviceSchema = z.object({
  udid: SimUdidSchema,
  name: z.string(),
  runtime: z.string(),
  state: SimStateSchema,
  widthPt: z.int().positive().nullable(),
  heightPt: z.int().positive().nullable(),
  scale: z.number().positive().nullable(),
  error: z.string().nullable(),
});
export type SimDevice = z.infer<typeof SimDeviceSchema>;

/** `POST /v1/ios/simulator`. */
export const BootSimulatorSchema = z.object({ udid: SimUdidSchema });
export type BootSimulator = z.infer<typeof BootSimulatorSchema>;

/** Same shape as the Android link (`POST/DELETE /v1/ios/link` take `LinkSandbox`). */
export const IosLinkInfoSchema = AndroidLinkInfoSchema;
export type IosLinkInfo = z.infer<typeof IosLinkInfoSchema>;

const MetroPortSchema = z.int().min(1024).max(65535);

/** A Mac loopback listener of the reverse Metro tunnel: `listening: false` + `error` when the port is taken on the Mac. */
export const IosTunnelSchema = z.object({
  port: MetroPortSchema,
  listening: z.boolean(),
  connections: z.int().nonnegative(),
  error: z.string().nullable(),
});
export type IosTunnel = z.infer<typeof IosTunnelSchema>;

export const IosInstallStateSchema = z.enum(IOS_INSTALL_STATES);
export type IosInstallState = z.infer<typeof IosInstallStateSchema>;

/**
 * A sandbox `install` request. Installing a sandbox `.app` runs native code on the Mac, so one whose `sha256` was never
 * approved stays `pending` until `POST /v1/ios/installs/:id` decides (or `expiresAt` passes: `expired`).
 */
export const IosInstallRequestSchema = z.object({
  id: IosInstallIdSchema,
  artifactId: ArtifactIdSchema,
  fileName: z.string(),
  sizeBytes: ByteCountSchema,
  sha256: z.string().regex(SHA256_PATTERN, "Invalid sha256"),
  udid: SimUdidSchema,
  state: IosInstallStateSchema,
  bundleId: z.string().nullable(),
  createdAt: TimestampSchema,
  expiresAt: TimestampSchema,
  error: z.string().nullable(),
});
export type IosInstallRequest = z.infer<typeof IosInstallRequestSchema>;

/** `POST /v1/ios/installs/:id` (session auth): `approve: true` also remembers the bundle hash for later installs. */
export const DecideIosInstallSchema = z.object({ approve: z.boolean() });
export type DecideIosInstall = z.infer<typeof DecideIosInstallSchema>;

/** `GET /v1/ios` of the host daemon; a missing tool gives `available: false`, a `reasonCode` and a `reason`, never an error. */
export const HostIosStatusSchema = z.object({
  available: z.boolean(),
  reason: z.string().nullable(),
  reasonCode: IosUnavailableCodeSchema.nullable(),
  /** `Xcode 26.0` from `xcodebuild -version`; null without Xcode. */
  xcode: z.string().nullable(),
  idb: z.boolean(),
  isolation: IosIsolationModeSchema,
  devices: z.array(SimDeviceSchema),
  /** The device the screen, the link and installs use: the one this daemon booted, else the first booted one. */
  booted: SimDeviceSchema.nullable(),
  link: IosLinkInfoSchema,
  tunnels: z.array(IosTunnelSchema),
  /** Install requests of this daemon run, newest first (pending ones need a decision). */
  installs: z.array(IosInstallRequestSchema),
});
export type HostIosStatus = z.infer<typeof HostIosStatusSchema>;

export const IosScreenQuerySchema = z.object({
  ticket: z.string().min(1),
  maxSize: z.coerce.number<string | number | undefined>().int().min(1).max(LIMITS.maxAndroidScreenSize).optional(),
  /** A booted device to stream; the status' `booted` device when missing. */
  udid: SimUdidSchema.optional(),
  /** `h264` when the viewer can decode H.264; the host falls back to JPEG otherwise. */
  codec: AndroidStreamEncodingSchema.optional(),
});
export type IosScreenQuery = z.infer<typeof IosScreenQuerySchema>;

/**
 * How the host streams an iOS Simulator screen (Android's settings without `device`, same limits); a new screen session uses
 * the settings current when it starts. `maxSize` caps the viewer's own size (null: the viewer decides).
 */
export const IosStreamSettingsSchema = AndroidStreamSettingsSchema.omit({ device: true });
export type IosStreamSettings = z.infer<typeof IosStreamSettingsSchema>;

/** `PUT /v1/ios/stream`: the fields to change. */
export const UpdateIosStreamSchema = IosStreamSettingsSchema.partial();
export type UpdateIosStream = z.infer<typeof UpdateIosStreamSchema>;

const RequestIdSchema = z.string().min(1).max(LIMITS.maxIosRequestIdLength).regex(/^[A-Za-z0-9._:-]+$/, "Invalid request id");

export const IosAppSchemeSchema = z
  .string()
  .regex(IOS_APP_SCHEME_PATTERN, "Invalid URL scheme")
  .refine((scheme) => !(IOS_RESERVED_URL_SCHEMES as readonly string[]).includes(scheme), "That URL scheme is reserved");

/** A running `*-ios` app run as the sandbox announces it: its Metro port in the sandbox (also the Mac port) and app scheme. */
export const IosRunSchema = z.object({
  port: MetroPortSchema,
  scheme: IosAppSchemeSchema.nullable(),
});
export type IosRun = z.infer<typeof IosRunSchema>;

export const IosLinkStageSchema = z.enum(IOS_LINK_STAGES);
export type IosLinkStage = z.infer<typeof IosLinkStageSchema>;

/** Host → sandbox text frames on `/v1/ios/link`. */
export const IosLinkHostMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), hostId: z.string(), version: z.string() }),
  /** On connect and on every change; `booted` carries no host error detail. */
  z.object({ type: z.literal("simulator"), available: z.boolean(), booted: SimDeviceSchema.nullable() }),
  /** The Mac listeners for the announced runs (after every `runs`). */
  z.object({ type: z.literal("tunnels"), tunnels: z.array(IosTunnelSchema).max(LIMITS.maxIosRuns) }),
  z.object({ type: z.literal("progress"), requestId: RequestIdSchema, stage: IosLinkStageSchema }),
  /** The end of a request; `bundleId` of an installed app. */
  z.object({
    type: z.literal("result"),
    requestId: RequestIdSchema,
    ok: z.boolean(),
    error: z.string().nullable(),
    bundleId: z.string().nullable().optional(),
  }),
  z.object({ type: z.literal("pong") }),
]);
export type IosLinkHostMessage = z.infer<typeof IosLinkHostMessageSchema>;

/** Sandbox → host text frames on `/v1/ios/link`. */
export const IosLinkSandboxMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ping") }),
  /** Every running `*-ios` app run (the whole set each time; `[]` closes every Mac listener). */
  z.object({ type: z.literal("runs"), runs: z.array(IosRunSchema).max(LIMITS.maxIosRuns) }),
  /**
   * Open a URL on the booted device: `exp://127.0.0.1:<announced port>[/…]` (Expo Go is installed first when missing,
   * `expoSdkVersion` picks its build) or `<announced scheme>:…`. Anything else is refused.
   */
  z.object({
    type: z.literal("openUrl"),
    requestId: RequestIdSchema,
    url: z.string().min(1).max(LIMITS.maxIosUrlLength),
    expoSdkVersion: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}$/).optional(),
  }),
  /** Install a simulator build (`.tar.gz`, `.tgz` or `.zip` with an `.app`) that is a sandbox artifact; needs the user's approval. */
  z.object({ type: z.literal("install"), requestId: RequestIdSchema, artifactId: ArtifactIdSchema }),
]);
export type IosLinkSandboxMessage = z.infer<typeof IosLinkSandboxMessageSchema>;

export const IosLinkRequestStateSchema = z.enum(IOS_LINK_REQUEST_STATES);
export type IosLinkRequestState = z.infer<typeof IosLinkRequestStateSchema>;

/**
 * A request the sandbox sent over the iOS link (`openUrl` of an `expo-ios` run, `install` of an artifact): `running`
 * with the host's last `progress` stage until its `result`. `bundleId` of an installed app.
 */
export const IosLinkRequestSchema = z.object({
  id: RequestIdSchema,
  type: z.enum(IOS_LINK_REQUEST_TYPES),
  url: z.string().nullable(),
  artifactId: ArtifactIdSchema.nullable(),
  state: IosLinkRequestStateSchema,
  stage: IosLinkStageSchema.nullable(),
  bundleId: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: TimestampSchema,
  endedAt: TimestampSchema.nullable(),
});
export type IosLinkRequest = z.infer<typeof IosLinkRequestSchema>;

/** `POST /v1/ios/installs` of the controller: install a simulator build artifact on the linked host's booted device. */
export const InstallOnSimulatorSchema = z.object({ artifactId: ArtifactIdSchema });
export type InstallOnSimulator = z.infer<typeof InstallOnSimulatorSchema>;

/** `GET /v1/ios` of the controller (the sandbox side of the iOS link); `requests` newest first. */
export const SandboxIosStatusSchema = z.object({
  linked: z.boolean(),
  hostId: z.string().nullable(),
  available: z.boolean(),
  booted: SimDeviceSchema.nullable(),
  tunnels: z.array(IosTunnelSchema),
  runs: z.array(IosRunSchema),
  requests: z.array(IosLinkRequestSchema),
});
export type SandboxIosStatus = z.infer<typeof SandboxIosStatusSchema>;

/** Query of `WS /v1/ios/link/streams/:id` (host → sandbox, one per TCP connection the Simulator opens to a Mac listener). */
export const IosLinkStreamQuerySchema = z.object({
  ticket: z.string().min(1),
  port: z.coerce.number<string | number>().int().min(1024).max(65535),
});
export type IosLinkStreamQuery = z.infer<typeof IosLinkStreamQuerySchema>;

export const IOS_URL_REFUSALS = {
  invalid: "Not a valid URL",
  tooLong: "The URL is too long",
  credentials: "The URL must not contain credentials",
  expHost: "Expo URLs must point at exp://127.0.0.1:<port> of a running iOS app run",
  scheme: "That URL scheme is not an app scheme of a running iOS app run",
} as const;

/** Why the host refuses to open `url` for these runs, or null when it may (shared by the host and the sandbox). */
export function iosOpenUrlRefusal(url: string, runs: readonly IosRun[]): string | null {
  if (url.length > LIMITS.maxIosUrlLength) return IOS_URL_REFUSALS.tooLong;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return IOS_URL_REFUSALS.invalid;
  }
  if (parsed.username || parsed.password) return IOS_URL_REFUSALS.credentials;
  const scheme = parsed.protocol.replace(/:$/, "").toLowerCase();
  if (scheme === "exp") {
    const port = Number(parsed.port);
    return parsed.hostname === "127.0.0.1" && runs.some((run) => run.port === port) ? null : IOS_URL_REFUSALS.expHost;
  }
  if (!IosAppSchemeSchema.safeParse(scheme).success) return IOS_URL_REFUSALS.scheme;
  return runs.some((run) => run.scheme === scheme) ? null : IOS_URL_REFUSALS.scheme;
}

/** Whether a URL opens Expo Go (so the host installs it first when missing). */
export const isExpoGoUrl = (url: string) => /^exp:\/\//i.test(url);
