import type { DefineContract } from "../ipc-types";
import type { CheckItem } from "./common";

export type DockerKind = "engine" | "desktop" | "rootless" | "podman" | "colima" | "orbstack" | "unknown";
export type DockerDaemon = "unknown" | "reachable" | "stopped" | "permission" | "unresponsive";

export type DockerActionKey =
  | "install"
  | "start"
  | "fix-permission"
  | "install-wsl"
  | "update-wsl"
  | "compose-docs"
  | "buildx-docs"
  | "virtualization-docs";

export type DockerCheck = CheckItem<DockerActionKey>;

export interface DockerServerInfo {
  version: string;
  os: string;
  arch: string;
  ncpu: number;
  memBytes: number;
  rootDir: string;
  rootless: boolean;
}

export interface DockerReport {
  cli: { path: string; version: string } | null;
  daemon: DockerDaemon;
  daemonError: string | null;
  kind: DockerKind;
  context: string | null;
  server: DockerServerInfo | null;
  compose: string | null;
  buildx: string | null;
  linux?: { inDockerGroup: boolean; socketGroup: string | null; systemd: boolean; serviceActive: boolean | null };
  windows?: { wsl: string | null; virtualization: boolean | null; desktopExe: string | null };
  mac?: { desktopApp: string | null; minOs: string | null };
  checks: DockerCheck[];
}

export type DockerPhase =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "installing"; stage: "downloading" | "verifying" | "installing"; received: number; total: number | null }
  | { kind: "starting"; since: number }
  | { kind: "needs-relogin" }
  | { kind: "needs-reboot" }
  | { kind: "ready" }
  | { kind: "blocked"; reason: string; commands?: string[] };

export type DockerInstallOption =
  | "desktop"
  | "desktop-user"
  | "engine"
  | "desktop-linux"
  | "manual"
  | "wsl"
  | "docker-group"
  | "kvm-group";

export interface DockerInstallRequest {
  option: DockerInstallOption;
  acceptLicense: boolean;
}

export type DockerContract = DefineContract<{
  methods: {
    check(): DockerReport;
    phase(): DockerPhase;
    install(request: DockerInstallRequest): DockerPhase;
    start(): DockerPhase;
    cancel(): DockerPhase;
    log(): string[];
  };
  events: {
    report: DockerReport;
    phase: DockerPhase;
    log: string;
  };
}>;
