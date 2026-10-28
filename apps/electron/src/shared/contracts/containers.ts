import type { Deploy } from "@tesseract/protocol";
import type { DefineContract } from "../ipc-types";
import type { CheckItem } from "./common";

export type ContainerState = "running" | "starting" | "stopped" | "error";

export interface ContainerTailnet {
  hostname: string;
  dnsName: string | null;
  ip: string | null;
  online: boolean;
  sshTarget: string;
}

export interface ServerContainer {
  name: string;
  id: string;
  state: ContainerState;
  status: string;
  image: string;
  createdAt: string;
  cpus: number | null;
  memoryMb: number | null;
  tailnet: ContainerTailnet | null;
  tunnel: "none" | "running" | "stopped";
  /** Sandbox deploys run without asking; otherwise each one waits for approval. */
  autoDeploy: boolean;
}

export type RouteScheme = "http" | "https";

export type RouteStatus = "active" | "pending" | "error";

export interface DomainRoute {
  id: string;
  hostname: string;
  container: string;
  port: number;
  scheme: RouteScheme;
  status: RouteStatus;
  error: string | null;
  createdAt: string;
}

export interface CloudflareZone {
  id: string;
  name: string;
  accountId: string;
}

export type ContainersActionKey = "install-sysbox" | "setup-vm" | "build-image" | "tailscale-key" | "cloudflare-token";

export interface ContainersReport {
  sysbox: boolean;
  image: string | null;
  tailscaleKey: boolean;
  tailscaleTags: string;
  cloudflare: { connected: boolean; zones: CloudflareZone[]; error: string | null };
  checks: CheckItem<ContainersActionKey>[];
}

export interface CreateContainerRequest {
  name: string;
  cpus?: number | null;
  memoryMb?: number | null;
}

export interface AddRouteRequest {
  container: string;
  hostname: string;
  port: number;
  scheme?: RouteScheme;
}

export interface TailscaleKeyRequest {
  authKey?: string | null;
  tags?: string;
}

export type ContainersPhase =
  | { kind: "idle" }
  | { kind: "building"; step: string }
  | { kind: "setting-up-vm"; step: string }
  | { kind: "creating"; name: string }
  | { kind: "routing"; hostname: string };

/** A deploy request from a sandbox, as seen by this host. */
export interface HostDeploy extends Deploy {
  /** Label of the sandbox connection it came from. */
  sandbox: string;
}

export interface OpenShellRequest {
  id: string;
  name: string;
  cols: number;
  rows: number;
}

export interface ShellOutput {
  id: string;
  data: string;
}

export interface ShellExit {
  id: string;
  code: number | null;
}

export type ContainersContract = DefineContract<{
  methods: {
    report(): ContainersReport;
    list(): ServerContainer[];
    create(request: CreateContainerRequest): ServerContainer;
    start(name: string): ServerContainer;
    stop(name: string): ServerContainer;
    restart(name: string): ServerContainer;
    remove(name: string): void;
    logs(name: string): string[];
    buildImage(): ContainersReport;
    setupVm(): ContainersReport;
    cancel(): ContainersPhase;
    phase(): ContainersPhase;
    setTailscaleKey(request: TailscaleKeyRequest): ContainersReport;
    setCloudflareToken(token: string | null): ContainersReport;
    routes(): DomainRoute[];
    addRoute(request: AddRouteRequest): DomainRoute;
    removeRoute(id: string): void;
    syncRoutes(): DomainRoute[];
    openShell(request: OpenShellRequest): void;
    writeShell(id: string, data: string): void;
    resizeShell(id: string, cols: number, rows: number): void;
    closeShell(id: string): void;
    setAutoDeploy(name: string, enabled: boolean): ServerContainer;
    deploys(): HostDeploy[];
    approveDeploy(id: string): void;
    rejectDeploy(id: string): void;
  };
  events: {
    containers: ServerContainer[];
    routes: DomainRoute[];
    phase: ContainersPhase;
    log: string;
    shellData: ShellOutput;
    shellExit: ShellExit;
    deploys: HostDeploy[];
  };
}>;
