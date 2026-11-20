import { z } from "zod";
import { ACCOUNT_DEVICE_KINDS, ACCOUNT_PROVIDERS, LIMITS, TAILNET_STATES } from "../constants";
import { TimestampSchema } from "./primitives";

export const AccountProviderSchema = z.enum(ACCOUNT_PROVIDERS);
export type AccountProvider = z.infer<typeof AccountProviderSchema>;

export const AccountDeviceKindSchema = z.enum(ACCOUNT_DEVICE_KINDS);
export type AccountDeviceKind = z.infer<typeof AccountDeviceKindSchema>;

export const AccountEmailSchema = z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(LIMITS.maxAccountEmailLength));
export const AccountPasswordSchema = z.string().min(LIMITS.minAccountPasswordLength).max(LIMITS.maxAccountPasswordLength);
export const AccountDisplayNameSchema = z.string().trim().min(1).max(LIMITS.maxNameLength);
export const TailnetHostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, "Invalid device hostname");

export const AccountSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  displayName: z.string().nullable(),
  provider: AccountProviderSchema,
  createdAt: TimestampSchema,
});
export type Account = z.infer<typeof AccountSchema>;

export const AccountSessionSchema = z.object({
  token: z.string(),
  expiresAt: TimestampSchema,
  account: AccountSchema,
});
export type AccountSession = z.infer<typeof AccountSessionSchema>;

export const CreateAccountSchema = z.object({
  email: AccountEmailSchema,
  password: AccountPasswordSchema,
  displayName: AccountDisplayNameSchema.optional(),
});
export type CreateAccount = z.infer<typeof CreateAccountSchema>;

export const PasswordSignInSchema = z.object({
  email: AccountEmailSchema,
  password: z.string().min(1).max(LIMITS.maxAccountPasswordLength),
});
export type PasswordSignIn = z.infer<typeof PasswordSignInSchema>;

export const AppleSignInSchema = z.object({
  identityToken: z.string().min(1).max(8192),
  displayName: AccountDisplayNameSchema.optional(),
});
export type AppleSignIn = z.infer<typeof AppleSignInSchema>;

export const CreateDeviceKeySchema = z.object({
  kind: AccountDeviceKindSchema,
  hostname: TailnetHostnameSchema,
});
export type CreateDeviceKey = z.infer<typeof CreateDeviceKeySchema>;

export const DeviceKeySchema = z.object({
  authKey: z.string(),
  loginServer: z.string(),
  magicDnsSuffix: z.string(),
  hostname: z.string(),
  tags: z.array(z.string()),
  expiresAt: TimestampSchema,
});
export type DeviceKey = z.infer<typeof DeviceKeySchema>;

export const AccountDeviceSchema = z.object({
  id: z.string(),
  hostname: z.string(),
  dnsName: z.string().nullable(),
  ips: z.array(z.string()),
  kind: AccountDeviceKindSchema.nullable(),
  online: z.boolean(),
  lastSeen: TimestampSchema.nullable(),
});
export type AccountDevice = z.infer<typeof AccountDeviceSchema>;

export const AccountDeviceListSchema = z.object({ devices: z.array(AccountDeviceSchema) });
export type AccountDeviceList = z.infer<typeof AccountDeviceListSchema>;

export const AccountErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
export type AccountError = z.infer<typeof AccountErrorSchema>;

export const TailnetStateSchema = z.enum(TAILNET_STATES);
export type TailnetState = z.infer<typeof TailnetStateSchema>;

export const TailnetPeerSchema = z.object({
  hostName: z.string(),
  dnsName: z.string().nullable(),
  ips: z.array(z.string()),
  os: z.string().nullable(),
  online: z.boolean(),
});
export type TailnetPeer = z.infer<typeof TailnetPeerSchema>;

export const TailnetStatusSchema = z.object({
  state: TailnetStateSchema,
  hostName: z.string().nullable(),
  dnsName: z.string().nullable(),
  ips: z.array(z.string()),
  magicDnsSuffix: z.string().nullable(),
  loginServer: z.string().nullable(),
  error: z.string().nullable(),
  peers: z.array(TailnetPeerSchema),
});
export type TailnetStatus = z.infer<typeof TailnetStatusSchema>;
