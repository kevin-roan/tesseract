import type { Artifact, TaildropTarget, TaildropTargets } from "@tesseract/protocol";
import type { Config } from "../config";
import { errorMessage, forbidden, notFound, unavailable } from "../core/errors";
import type { Logger } from "../core/logger";
import type { ArtifactService } from "./artifacts";
import { mapWhoisNode, unixSocketFetch, type TailscaleFetch } from "./identity";

export type TaildropOptions = {
  fetch?: TailscaleFetch;
  timeoutMs?: number;
  sendTimeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 3_000;
const DEFAULT_SEND_TIMEOUT_MS = 15 * 60_000;
const UNAVAILABLE: TaildropTargets = { available: false, targets: [] };

/** One entry of `/localapi/v0/file-targets` (`apitype.FileTarget`). */
export function mapFileTarget(value: unknown): TaildropTarget | null {
  if (typeof value !== "object" || value === null) return null;
  const node = (value as { Node?: unknown }).Node;
  const id = (node as { StableID?: unknown } | undefined)?.StableID;
  const mapped = mapWhoisNode(node);
  if (typeof id !== "string" || !id || mapped === null) return null;
  return { id, hostName: mapped.hostName, dnsName: mapped.dnsName, os: mapped.os, online: mapped.online };
}

/** Pushes artifacts to the user's tailnet devices through the Tailscale LocalAPI (needs the socket opt-in). */
export class TaildropService {
  private readonly fetcher: TailscaleFetch;
  private readonly timeoutMs: number;
  private readonly sendTimeoutMs: number;

  constructor(
    config: Config,
    private readonly artifacts: ArtifactService,
    private readonly logger: Logger,
    options: TaildropOptions = {},
  ) {
    this.fetcher = options.fetch ?? unixSocketFetch(config.tailscaleSocket);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.sendTimeoutMs = options.sendTimeoutMs ?? DEFAULT_SEND_TIMEOUT_MS;
  }

  async targets(): Promise<TaildropTargets> {
    try {
      const response = await this.fetcher("/localapi/v0/file-targets", AbortSignal.timeout(this.timeoutMs));
      if (!response.ok) {
        this.logger.debug("taildrop targets failed", { status: response.status, body: (await response.text()).slice(0, 200) });
        return UNAVAILABLE;
      }
      const body = (await response.json()) as unknown;
      if (!Array.isArray(body)) return UNAVAILABLE;
      const targets = body.map(mapFileTarget).filter((target): target is TaildropTarget => target !== null);
      return { available: true, targets: targets.sort((a, b) => a.hostName.localeCompare(b.hostName)) };
    } catch (error) {
      this.logger.debug("taildrop unreachable", { error });
      return UNAVAILABLE;
    }
  }

  async send(artifactId: string, targetId: string): Promise<Artifact> {
    const { artifact, path } = this.artifacts.download(artifactId);
    const { available, targets } = await this.targets();
    if (!available) throw unavailable("Taildrop is not available: the Tailscale LocalAPI socket is not shared with this sandbox");
    const target = targets.find((candidate) => candidate.id === targetId);
    if (!target) throw notFound(`Taildrop target ${targetId.slice(0, 80)} not found`);
    const file = Bun.file(path);
    let response: Response;
    try {
      response = await this.fetcher(
        `/localapi/v0/file-put/${encodeURIComponent(target.id)}/${encodeURIComponent(artifact.fileName)}`,
        AbortSignal.timeout(this.sendTimeoutMs),
        { method: "PUT", body: file, headers: { "Content-Length": String(file.size), "Content-Type": "application/octet-stream" } },
      );
    } catch (error) {
      throw unavailable(`Taildrop to ${target.hostName} failed: ${errorMessage(error)}`);
    }
    if (!response.ok) {
      const detail = (await response.text()).trim().slice(0, 200) || `HTTP ${response.status}`;
      if (response.status === 403) throw forbidden(`Tailscale refused Taildrop to ${target.hostName}: ${detail}`);
      if (response.status === 404) throw notFound(`Taildrop target ${target.hostName} not found: ${detail}`);
      throw unavailable(`Taildrop to ${target.hostName} failed: ${detail}`);
    }
    await response.body?.cancel();
    this.logger.info("artifact sent with taildrop", { id: artifact.id, target: target.hostName, bytes: file.size });
    return artifact;
  }
}
