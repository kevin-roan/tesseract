import { z } from "zod";
import { PidSchema, PortSchema, ProcessIdSchema, ProjectIdSchema } from "./primitives";

/** A TCP port something in the sandbox listens on, with the links that reach it over the tailnet. */
export const ListeningPortSchema = z.object({
  port: PortSchema,
  pid: PidSchema,
  command: z.string(),
  processId: ProcessIdSchema.nullable(),
  projectId: ProjectIdSchema.nullable(),
  /** `http://<sandbox tailscale IPv4>:<port>`; null while the sandbox has no Tailscale IP. */
  url: z.string().nullable(),
  /** `http://<sandbox MagicDNS name>:<port>`; null without MagicDNS. */
  dnsUrl: z.string().nullable(),
});
export type ListeningPort = z.infer<typeof ListeningPortSchema>;

export const ListeningPortsSchema = z.object({
  tailscaleIp: z.string().nullable(),
  ports: z.array(ListeningPortSchema),
});
export type ListeningPorts = z.infer<typeof ListeningPortsSchema>;
