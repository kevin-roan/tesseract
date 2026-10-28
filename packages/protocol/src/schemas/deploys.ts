import { z } from "zod";
import { DEPLOY_KINDS, DEPLOY_STATUSES, LIMITS } from "../constants";
import { ByteCountSchema, DeployIdSchema, PortSchema, ProjectIdSchema, TimestampSchema } from "./primitives";
import { Sha256Schema } from "./sync";

/** Same rule as server container names on the host (`tesseract-ct-<name>`). */
export const DEPLOY_CONTAINER_PATTERN = /^[a-z][a-z0-9-]{0,30}[a-z0-9]$/;
/** Compose project / image name of the app inside the container. */
export const DEPLOY_APP_PATTERN = /^[a-z0-9][a-z0-9_-]{0,62}$/;
export const DEPLOY_HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export const DeployContainerNameSchema = z.string().regex(DEPLOY_CONTAINER_PATTERN, "Invalid container name");
export const DeployAppNameSchema = z.string().regex(DEPLOY_APP_PATTERN, "Invalid app name");
export const DeployHostnameSchema = z.string().trim().toLowerCase().regex(DEPLOY_HOSTNAME_PATTERN, "Invalid hostname");

export const DeployCpusSchema = z.number().positive().max(LIMITS.maxDeployCpus);
export const DeployMemorySchema = z.int().min(LIMITS.minDeployMemoryMb).max(LIMITS.maxDeployMemoryMb);

export const DeployKindSchema = z.enum(DEPLOY_KINDS);
export type DeployKind = z.infer<typeof DeployKindSchema>;

export const DeployStatusSchema = z.enum(DEPLOY_STATUSES);
export type DeployStatus = z.infer<typeof DeployStatusSchema>;

/** A server container on a host that a sandbox may deploy to. */
export const DeployTargetSchema = z.object({
  name: DeployContainerNameSchema,
  running: z.boolean(),
  /** Deploys run without asking; otherwise the host user approves each one. */
  autoApprove: z.boolean(),
  /** Public URLs already routed to this container. */
  urls: z.array(z.string().max(LIMITS.maxSyncPathLength)).max(LIMITS.maxDeployTargets),
});
export type DeployTarget = z.infer<typeof DeployTargetSchema>;

export const DeployTargetsSchema = z.object({
  /** `null`: no host reported targets within `LIMITS.deployTargetsTtlMs`. */
  host: z.string().nullable(),
  reportedAt: TimestampSchema.nullable(),
  targets: z.array(DeployTargetSchema).max(LIMITS.maxDeployTargets),
});
export type DeployTargets = z.infer<typeof DeployTargetsSchema>;

/** `PUT /v1/deploys/targets`: host heartbeat with the containers it accepts deploys for. */
export const PutDeployTargetsSchema = z.object({
  host: z.string().trim().min(1).max(LIMITS.maxSyncHostLength),
  targets: z.array(DeployTargetSchema).max(LIMITS.maxDeployTargets),
});
export type PutDeployTargets = z.infer<typeof PutDeployTargetsSchema>;

export const DeploySchema = z.object({
  id: DeployIdSchema,
  container: DeployContainerNameSchema,
  app: DeployAppNameSchema,
  kind: DeployKindSchema,
  /** Absolute sandbox path the bundle was made from. */
  sourcePath: z.string(),
  projectId: ProjectIdSchema.nullable(),
  /** Port the app listens on inside the container; required with `hostname`. */
  port: PortSchema.nullable(),
  hostname: DeployHostnameSchema.nullable(),
  /** The host creates the container first when it does not exist (always asks the user). */
  create: z.boolean(),
  /** Limits for a container created by this deploy; `null`: host default. */
  cpus: DeployCpusSchema.nullable(),
  memoryMb: DeployMemorySchema.nullable(),
  status: DeployStatusSchema,
  sha256: Sha256Schema,
  bytes: ByteCountSchema,
  claimedBy: z.string().nullable(),
  /** Tail of the host-side deploy output. */
  log: z.string().max(LIMITS.maxDeployLogLength),
  urls: z.array(z.string()),
  error: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Deploy = z.infer<typeof DeploySchema>;

export const DeployListSchema = z.array(DeploySchema);

/** `POST /v1/deploys`: the controller archives `path` itself; the sandbox never touches Docker on the host. */
export const CreateDeploySchema = z
  .object({
    container: DeployContainerNameSchema,
    /** Absolute directory inside `/workspace` holding `compose.yml`/`docker-compose.yml` or a `Dockerfile`. */
    path: z.string().min(1).max(LIMITS.maxSyncPathLength),
    /** Default: the directory name, slugged. */
    app: DeployAppNameSchema.optional(),
    port: PortSchema.optional(),
    hostname: DeployHostnameSchema.optional(),
    /** Create `container` on the host if it does not exist yet. */
    create: z.boolean().optional(),
    cpus: DeployCpusSchema.optional(),
    memoryMb: DeployMemorySchema.optional(),
  })
  .refine((value) => value.hostname === undefined || value.port !== undefined, {
    message: "port is required with hostname",
    path: ["port"],
  })
  .refine((value) => value.create === true || (value.cpus === undefined && value.memoryMb === undefined), {
    message: "cpus and memoryMb need create",
    path: ["create"],
  });
export type CreateDeploy = z.infer<typeof CreateDeploySchema>;

export const ClaimDeploySchema = z.object({ host: z.string().trim().min(1).max(LIMITS.maxSyncHostLength) });
export type ClaimDeploy = z.infer<typeof ClaimDeploySchema>;

export const DeployProgressSchema = z.object({
  status: z.enum(["awaiting_approval", "deploying"]),
  /** Appended to the deploy log (the stored log keeps the last `maxDeployLogLength` chars). */
  log: z.string().max(LIMITS.maxDeployLogLength).optional(),
});
export type DeployProgress = z.infer<typeof DeployProgressSchema>;

export const CompleteDeploySchema = z.object({
  status: z.enum(["deployed", "failed", "rejected"]),
  log: z.string().max(LIMITS.maxDeployLogLength).optional(),
  urls: z.array(z.string().max(LIMITS.maxSyncPathLength)).max(LIMITS.maxDeployTargets).optional(),
  error: z.string().max(LIMITS.maxStatusMessageLength).optional(),
});
export type CompleteDeploy = z.infer<typeof CompleteDeploySchema>;

export const DeploysQuerySchema = z.object({
  status: DeployStatusSchema.optional(),
  container: DeployContainerNameSchema.optional(),
});
export type DeploysQuery = z.infer<typeof DeploysQuerySchema>;
