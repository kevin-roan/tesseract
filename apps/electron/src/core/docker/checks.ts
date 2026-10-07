import type { DockerCheck, DockerPhase, DockerReport } from "../../shared/contracts/docker";
import {
  MIN_COMPOSE_VERSION,
  MIN_CPUS,
  MIN_ENGINE_VERSION,
  MIN_MEM_BYTES,
  MIN_WSL_VERSION,
  REQUIRED_CHECKS,
  REQUIRED_WINDOWS_CHECKS,
  WANTED_MEM_BYTES,
} from "./constants";
import { CHECK_DETAILS, CHECK_TITLES, KIND_LABELS } from "./labels";
import { formatGb, isAtLeast } from "./parse";

export interface CheckContext {
  platform: NodeJS.Platform;
  user: string;
  configuredInGroup: boolean;
  platformBlock: string | null;
}

const ok = (id: string, title: string, detail: string): DockerCheck => ({ id, status: "ok", title, detail });

function cliCheck(report: DockerReport, context: CheckContext): DockerCheck {
  if (!report.cli) {
    return context.platformBlock
      ? { id: "cli", status: "error", title: CHECK_TITLES.cli, detail: context.platformBlock }
      : { id: "cli", status: "error", title: CHECK_TITLES.cli, detail: CHECK_DETAILS.cliMissing, action: "install" };
  }
  return ok("cli", CHECK_TITLES.cli, CHECK_DETAILS.cliOk(KIND_LABELS[report.kind], report.cli.version).trim());
}

function daemonCheck(report: DockerReport): DockerCheck {
  const title = CHECK_TITLES.daemon;
  switch (report.daemon) {
    case "reachable":
      return ok("daemon", title, CHECK_DETAILS.daemonOk(report.server?.os ?? "", report.server?.arch ?? "", report.context));
    case "permission":
      return { id: "daemon", status: "error", title, detail: CHECK_DETAILS.daemonPermission, action: "fix-permission" };
    case "unresponsive":
      return { id: "daemon", status: "error", title, detail: CHECK_DETAILS.daemonUnresponsive, action: "start" };
    case "stopped":
      return { id: "daemon", status: "error", title, detail: CHECK_DETAILS.daemonStopped, action: "start" };
    default:
      return { id: "daemon", status: "pending", title, detail: CHECK_DETAILS.daemonUnknown };
  }
}

function composeCheck(report: DockerReport): DockerCheck {
  const title = CHECK_TITLES.compose;
  if (!report.compose) return { id: "compose", status: "error", title, detail: CHECK_DETAILS.composeMissing, action: "compose-docs" };
  if (!isAtLeast(report.compose, MIN_COMPOSE_VERSION)) {
    return { id: "compose", status: "error", title, detail: CHECK_DETAILS.composeOld(report.compose), action: "compose-docs" };
  }
  return ok("compose", title, report.compose);
}

function buildxCheck(report: DockerReport): DockerCheck {
  const title = CHECK_TITLES.buildx;
  if (!report.buildx) return { id: "buildx", status: "error", title, detail: CHECK_DETAILS.buildxMissing, action: "buildx-docs" };
  return ok("buildx", title, CHECK_DETAILS.buildxOk(report.buildx));
}

function serverChecks(report: DockerReport): DockerCheck[] {
  const server = report.server;
  if (report.daemon !== "reachable" || !server) return [];
  const engine: DockerCheck = isAtLeast(server.version, MIN_ENGINE_VERSION)
    ? ok("engine_version", CHECK_TITLES.engineVersion, server.version)
    : { id: "engine_version", status: "warning", title: CHECK_TITLES.engineVersion, detail: CHECK_DETAILS.engineOld(server.version) };
  const mem = formatGb(server.memBytes);
  const resources: DockerCheck =
    server.ncpu < MIN_CPUS || server.memBytes < MIN_MEM_BYTES
      ? { id: "resources", status: "error", title: CHECK_TITLES.resources, detail: CHECK_DETAILS.resourcesLow(server.ncpu, mem) }
      : server.memBytes < WANTED_MEM_BYTES
        ? {
            id: "resources",
            status: "warning",
            title: CHECK_TITLES.resources,
            detail: CHECK_DETAILS.resourcesLimited(mem) + (report.kind === "desktop" ? CHECK_DETAILS.resourcesDesktopHint : ""),
          }
        : ok("resources", CHECK_TITLES.resources, CHECK_DETAILS.resourcesOk(server.ncpu, mem));
  return [engine, resources];
}

function linuxChecks(report: DockerReport, context: CheckContext): DockerCheck[] {
  const checks: DockerCheck[] = [];
  const rootless = report.kind === "rootless" || report.server?.rootless === true;
  if (report.linux && report.kind === "engine" && !rootless) {
    const title = CHECK_TITLES.group;
    checks.push(
      report.linux.inDockerGroup
        ? ok("group", title, CHECK_DETAILS.groupOk(context.user))
        : context.configuredInGroup
          ? { id: "group", status: "warning", title, detail: CHECK_DETAILS.groupPending(context.user) }
          : { id: "group", status: "warning", title, detail: CHECK_DETAILS.groupMissing(context.user), action: "fix-permission" },
    );
  }
  if (rootless) checks.push({ id: "rootless", status: "warning", title: CHECK_TITLES.rootless, detail: CHECK_DETAILS.rootless });
  return checks;
}

function windowsChecks(report: DockerReport): DockerCheck[] {
  if (!report.windows) return [];
  const { wsl, virtualization } = report.windows;
  const checks: DockerCheck[] = [
    !wsl
      ? { id: "wsl", status: "error", title: CHECK_TITLES.wsl, detail: CHECK_DETAILS.wslMissing, action: "install-wsl" }
      : !isAtLeast(wsl, MIN_WSL_VERSION)
        ? { id: "wsl", status: "error", title: CHECK_TITLES.wsl, detail: CHECK_DETAILS.wslOld(wsl), action: "update-wsl" }
        : ok("wsl", CHECK_TITLES.wsl, CHECK_DETAILS.wslOk(wsl)),
  ];
  if (virtualization === true) checks.push(ok("virtualization", CHECK_TITLES.virtualization, CHECK_DETAILS.virtualizationOk));
  if (virtualization === false) {
    checks.push({
      id: "virtualization",
      status: "error",
      title: CHECK_TITLES.virtualization,
      detail: CHECK_DETAILS.virtualizationOff,
      action: "virtualization-docs",
    });
  }
  return checks;
}

export function buildChecks(report: DockerReport, context: CheckContext): DockerCheck[] {
  const cli = cliCheck(report, context);
  if (!report.cli) return [cli, ...windowsChecks(report)];
  const podman: DockerCheck[] =
    report.kind === "podman" ? [{ id: "podman", status: "error", title: CHECK_TITLES.podman, detail: CHECK_DETAILS.podman }] : [];
  return [
    cli,
    ...podman,
    daemonCheck(report),
    composeCheck(report),
    buildxCheck(report),
    ...serverChecks(report),
    ...linuxChecks(report, context),
    ...windowsChecks(report),
  ];
}

export function requiredCheckIds(platform: NodeJS.Platform): string[] {
  return [...REQUIRED_CHECKS, ...(platform === "win32" ? REQUIRED_WINDOWS_CHECKS : [])];
}

export function isDockerReady(report: DockerReport, platform: NodeJS.Platform): boolean {
  if (!report.cli || report.daemon !== "reachable") return false;
  return requiredCheckIds(platform).every((id) => report.checks.find((check) => check.id === id)?.status !== "error");
}

export function phaseFromReport(report: DockerReport, platform: NodeJS.Platform): DockerPhase {
  if (isDockerReady(report, platform)) return { kind: "ready" };
  const required = requiredCheckIds(platform);
  const blocking =
    report.checks.find((check) => check.status === "error" && required.includes(check.id)) ??
    report.checks.find((check) => check.status === "error");
  return { kind: "blocked", reason: blocking?.detail ?? CHECK_DETAILS.daemonUnknown };
}
