import { unwatchFile, watchFile } from "node:fs";
import { hostname } from "node:os";
import { TesseractClient, type StreamConnection } from "@tesseract/client";
import { readConfig } from "../../core/config";
import type { ContainersService } from "../../core/containers";
import { DeployService, HttpDeployApi } from "../../core/deploys";
import { createLogger } from "../../core/log";
import { CONFIG_POLL_MS } from "../../core/syncback/constants";
import type { HostDeploy } from "../../shared/contracts/containers";
import type { ConnectionConfig } from "../../shared/contracts/connection";
import { showNotification } from "./notifications";
import { storedConnection } from "./token-cipher";

const log = createLogger("deploys");

function sandboxLabel(config: ConnectionConfig): string {
  if (config.name) return config.name;
  try {
    return new URL(config.apiUrl).host;
  } catch {
    return config.apiUrl;
  }
}

class DeployRuntime {
  readonly service: DeployService;
  private api: HttpDeployApi | null = null;
  private stream: StreamConnection | null = null;
  private key = "";
  private label = "";

  constructor(
    private readonly configFile: string,
    containers: ContainersService,
    onChange: (deploys: HostDeploy[]) => void,
  ) {
    this.service = new DeployService({
      api: () => this.api,
      host: hostname(),
      sandbox: () => this.label,
      containers: {
        list: () => containers.list(),
        routes: () => containers.routes(),
        create: (request) => containers.create(request),
        deploy: (request, onLine, signal) => containers.deploy(request, onLine, signal),
      },
      notify: (id, title, body) => void showNotification({ id: `deploy-${id}`, title, body, command: { type: "navigate", page: "containers" } }),
      onChange,
    });
  }

  async refresh(): Promise<void> {
    const config = storedConnection(await readConfig(this.configFile));
    const key = config ? `${config.apiUrl}\n${config.token}` : "";
    if (key === this.key) return;
    this.key = key;
    this.disconnect();
    this.service.reset();
    if (!config) return;
    try {
      this.label = sandboxLabel(config);
      this.api = new HttpDeployApi({ apiUrl: config.apiUrl, token: config.token });
      this.stream = new TesseractClient({ baseUrl: config.apiUrl, token: config.token }).openEvents({
        onEvent: (event) => this.service.handleEvent(event),
        onStateChange: (state) => this.service.setOnline(state === "open"),
        onError: (error) => log.debug(`deploy events: ${error.message}`),
      });
    } catch (error) {
      log.warn(`deploys cannot use the saved connection: ${error instanceof Error ? error.message : String(error)}`);
      this.api = null;
    }
  }

  private disconnect(): void {
    this.stream?.close();
    this.stream = null;
    this.api = null;
    this.service.setOnline(false);
  }

  stop(): void {
    this.disconnect();
    this.service.stop();
  }
}

let runtime: DeployRuntime | null = null;

export function deployService(): DeployService | null {
  return runtime?.service ?? null;
}

export function startDeploys(configFile: string, containers: ContainersService, onChange: (deploys: HostDeploy[]) => void): () => void {
  const active = new DeployRuntime(configFile, containers, onChange);
  runtime = active;
  const poll = () => void active.refresh().catch((error: unknown) => log.debug(`deploys refresh failed: ${error instanceof Error ? error.message : String(error)}`));
  watchFile(configFile, { interval: CONFIG_POLL_MS }, poll);
  poll();
  return () => {
    unwatchFile(configFile, poll);
    active.stop();
    if (runtime === active) runtime = null;
  };
}
