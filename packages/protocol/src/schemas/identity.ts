import { z } from "zod";
import { IDENTITY_SOURCES } from "../constants";

export const IdentitySourceSchema = z.enum(IDENTITY_SOURCES);
export type IdentitySource = z.infer<typeof IdentitySourceSchema>;

export const TailscaleUserSchema = z.object({
  id: z.string(),
  loginName: z.string(),
  displayName: z.string(),
  profilePicUrl: z.string().nullable(),
});
export type TailscaleUser = z.infer<typeof TailscaleUserSchema>;

export const TailnetNodeSchema = z.object({
  hostName: z.string(),
  dnsName: z.string().nullable(),
  os: z.string().nullable(),
  tailscaleIps: z.array(z.string()),
  online: z.boolean(),
});
export type TailnetNode = z.infer<typeof TailnetNodeSchema>;

export const TailscaleIdentitySchema = z.object({
  available: z.boolean(),
  source: IdentitySourceSchema,
  tailnet: z.string().nullable(),
  viewer: TailscaleUserSchema.nullable(),
  viewerNode: TailnetNodeSchema.nullable(),
  owner: TailscaleUserSchema.nullable(),
  node: TailnetNodeSchema.nullable(),
});
export type TailscaleIdentity = z.infer<typeof TailscaleIdentitySchema>;

export const IdentitySchema = z.object({
  sandboxId: z.string(),
  tailscale: TailscaleIdentitySchema,
});
export type Identity = z.infer<typeof IdentitySchema>;
