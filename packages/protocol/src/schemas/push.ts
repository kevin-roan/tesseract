import { z } from "zod";
import { INBOX_KINDS } from "../constants";
import { ArtifactIdSchema, InboxIdSchema, TimestampSchema } from "./primitives";

export const PUSH_PLATFORMS = ["ios", "android"] as const;
export const PushPlatformSchema = z.enum(PUSH_PLATFORMS);
export type PushPlatform = z.infer<typeof PushPlatformSchema>;

/** An Expo push token (`ExponentPushToken[…]` / `ExpoPushToken[…]`), delivered through FCM on Android and APNs on iOS. */
export const PushTokenSchema = z.string().regex(/^Expo(nent)?PushToken\[[^\]\s]{1,256}\]$/, "Invalid Expo push token");
export type PushToken = z.infer<typeof PushTokenSchema>;

export const RegisterPushDeviceSchema = z.object({
  token: PushTokenSchema,
  platform: PushPlatformSchema,
  name: z.string().trim().min(1).max(128).nullable().optional(),
});
export type RegisterPushDevice = z.infer<typeof RegisterPushDeviceSchema>;

export const PushDeviceSchema = z.object({
  token: PushTokenSchema,
  platform: PushPlatformSchema,
  name: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type PushDevice = z.infer<typeof PushDeviceSchema>;

/** The `data` of a push the controller sends for an inbox item. */
export const PushDataSchema = z.object({
  url: z.literal("/inbox"),
  sandboxId: z.string(),
  itemId: InboxIdSchema,
  kind: z.enum(INBOX_KINDS),
  artifactId: ArtifactIdSchema.nullable(),
});
export type PushData = z.infer<typeof PushDataSchema>;

export const LIVE_ACTIVITY_TOKEN_KINDS = ["activity", "push-to-start"] as const;
export const LiveActivityTokenKindSchema = z.enum(LIVE_ACTIVITY_TOKEN_KINDS);
export type LiveActivityTokenKind = z.infer<typeof LiveActivityTokenKindSchema>;

/** An ActivityKit token (hex): the update token of a started Live Activity or the app's push-to-start token. */
export const LiveActivityPushTokenSchema = z.string().min(32).max(512).regex(/^[0-9a-f]+$/i, "Invalid Live Activity token");

export const RegisterLiveActivitySchema = z.object({
  kind: LiveActivityTokenKindSchema,
  token: LiveActivityPushTokenSchema,
  /** ActivityKit id of the running activity; null for push-to-start tokens. */
  activityId: z.string().max(128).nullable().default(null),
});
export type RegisterLiveActivity = z.infer<typeof RegisterLiveActivitySchema>;

export const LiveActivityTokenSchema = RegisterLiveActivitySchema.extend({
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type LiveActivityToken = z.infer<typeof LiveActivityTokenSchema>;
