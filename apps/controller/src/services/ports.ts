import { relative, sep } from "node:path";
import { isValidProjectId, type ListeningPort, type ListeningPorts } from "@tesseract/protocol";
import type { Config } from "../config";
import { isInside, realpathOrNull } from "../core/paths";
import { listListeningPorts, type ListeningPortOwner } from "../core/ports";
import { readProcCwd } from "../core/proc";
import type { IdentityService } from "./identity";
import type { ProcessService } from "./processes";

export type PortScanner = {
  listen: () => ListeningPortOwner[];
  cwd: (pid: number) => string | null;
};

const procScanner: PortScanner = { listen: listListeningPorts, cwd: readProcCwd };

/** The project directory directly under `projectsDir` that contains `cwd`. */
export function projectForCwd(projectsDir: string, cwd: string | null): string | null {
  if (cwd === null || !isInside(projectsDir, cwd)) return null;
  const id = relative(projectsDir, cwd).split(sep)[0] ?? "";
  return isValidProjectId(id) ? id : null;
}

export class PortService {
  private readonly internal: Set<number>;

  constructor(
    private readonly config: Config,
    private readonly processes: ProcessService,
    private readonly identity: IdentityService,
    private readonly scanner: PortScanner = procScanner,
  ) {
    this.internal = new Set([config.port, config.vncPort]);
  }

  /** Hides a port the controller itself serves on (the bound port when TESSERACT_PORT is 0). */
  ignore(port: number): void {
    this.internal.add(port);
  }

  async list(): Promise<ListeningPorts> {
    const node = this.identity.selfNode();
    const owners = this.scanner.listen().filter((owner) => !this.internal.has(owner.port));
    const projectsDir = realpathOrNull(this.config.projectsDir) ?? this.config.projectsDir;
    const self = await node;
    const tailscaleIp = self?.tailscaleIps.find((ip) => !ip.includes(":")) ?? null;
    const dnsName = self?.dnsName ?? null;
    const ports = owners.map((owner): ListeningPort => {
      const tracked = this.processes.ownerOf(owner);
      return {
        port: owner.port,
        pid: owner.pid,
        command: owner.command,
        processId: tracked?.id ?? null,
        projectId: tracked?.projectId ?? projectForCwd(projectsDir, this.scanner.cwd(owner.pid)),
        url: tailscaleIp ? `http://${tailscaleIp}:${owner.port}` : null,
        dnsUrl: dnsName ? `http://${dnsName}:${owner.port}` : null,
      };
    });
    return { tailscaleIp, ports: ports.sort((a, b) => a.port - b.port) };
  }
}
