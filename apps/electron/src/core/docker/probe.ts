import { join, win32 } from "node:path";
import { commandError } from "../process";
import type { DockerDaemon, DockerKind, DockerReport, DockerServerInfo } from "../../shared/contracts/docker";
import { buildChecks } from "./checks";
import {
  DOCKER_DESKTOP_USER_SERVICE,
  DOCKER_GROUP,
  DOCKER_SERVICE,
  DOCKER_SOCKET,
  MAC_DESKTOP_APP,
  MIN_MAC_OS_VERSION,
  SYSTEMD_RUN_DIR,
  WIN_DESKTOP_EXE,
} from "./constants";
import { PLATFORM_MESSAGES } from "./labels";
import {
  cleanVersion,
  classifyDaemonError,
  decodeWslOutput,
  isAtLeast,
  isSupportedWindowsBuild,
  kindFromContext,
  parseBuildxVersion,
  parseCliVersion,
  parseGetentMembers,
  parseGetentName,
  parseGroups,
  parseInfoJson,
  parseServiceState,
  parseVersionJson,
  parseVirtualization,
  parseWslVersion,
  windowsBuild,
  type InfoSummary,
} from "./parse";
import { createRuntime, runLogged, runQuiet, type DockerRunOptions, type DockerRuntime } from "./runtime";

const JSON_FORMAT = "{{json .}}";
const VIRTUALIZATION_SCRIPT =
  "(Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled; (Get-CimInstance Win32_ComputerSystem).HypervisorPresent";

export interface DaemonState {
  daemon: DockerDaemon;
  daemonError: string | null;
  context: string | null;
  server: { version: string; os: string; arch: string; podman: boolean } | null;
}

export function dockerBinary(runtime: DockerRuntime): string | null {
  return runtime.system.which("docker", runtime.env, runtime.host.platform);
}

export async function readDaemon(runtime: DockerRuntime, cli: string, logged = true): Promise<DaemonState> {
  const args = ["version", "--format", JSON_FORMAT];
  const result = logged ? await runLogged(runtime, cli, args) : await runQuiet(runtime, cli, args);
  const parsed = parseVersionJson(result.stdout);
  if (result.code === 0 && parsed.server) {
    return { daemon: "reachable", daemonError: null, context: parsed.context, server: parsed.server };
  }
  const daemonError = commandError("docker", args, result);
  if (logged) runtime.log(daemonError);
  return { daemon: classifyDaemonError(result.stderr, result.timedOut), daemonError, context: parsed.context, server: null };
}

export function windowsDesktopExeCandidates(env: NodeJS.ProcessEnv, home: string): string[] {
  const programFiles = env.ProgramFiles ?? "C:\\Program Files";
  const localAppData = env.LOCALAPPDATA ?? win32.join(home, "AppData", "Local");
  return [
    win32.join(programFiles, "Docker", "Docker", WIN_DESKTOP_EXE),
    win32.join(localAppData, "Programs", "DockerDesktop", WIN_DESKTOP_EXE),
  ];
}

export function macDesktopAppCandidates(home: string): string[] {
  return [join("/Applications", MAC_DESKTOP_APP), join(home, "Applications", MAC_DESKTOP_APP)];
}

function firstExisting(runtime: DockerRuntime, paths: string[]): string | null {
  return paths.find((path) => runtime.system.exists(path)) ?? null;
}

async function readCli(runtime: DockerRuntime, cli: string): Promise<{ version: string; podman: boolean }> {
  const result = await runLogged(runtime, cli, ["--version"]);
  return parseCliVersion(result.stdout) ?? { version: "", podman: false };
}

async function readContext(runtime: DockerRuntime, cli: string): Promise<string | null> {
  const result = await runQuiet(runtime, cli, ["context", "show"]);
  return result.code === 0 ? result.stdout.trim() || null : null;
}

async function readInfo(runtime: DockerRuntime, cli: string): Promise<InfoSummary | null> {
  const result = await runLogged(runtime, cli, ["info", "--format", JSON_FORMAT]);
  return parseInfoJson(result.stdout);
}

async function readCompose(runtime: DockerRuntime, cli: string): Promise<string | null> {
  const result = await runQuiet(runtime, cli, ["compose", "version", "--short"]);
  return result.code === 0 ? cleanVersion(result.stdout) : null;
}

async function readBuildx(runtime: DockerRuntime, cli: string): Promise<string | null> {
  const result = await runQuiet(runtime, cli, ["buildx", "version"]);
  return result.code === 0 ? parseBuildxVersion(result.stdout) : null;
}

export async function readWslVersion(runtime: DockerRuntime): Promise<string | null> {
  const wsl = runtime.system.which("wsl", runtime.env, runtime.host.platform);
  if (!wsl) return null;
  const result = await runQuiet(runtime, wsl, ["--version"], "latin1");
  return result.code === 0 ? parseWslVersion(decodeWslOutput(result.stdout)) : null;
}

async function readVirtualization(runtime: DockerRuntime): Promise<boolean | null> {
  const result = await runQuiet(runtime, "powershell", ["-NoProfile", "-NonInteractive", "-Command", VIRTUALIZATION_SCRIPT]);
  return result.code === 0 ? parseVirtualization(result.stdout) : null;
}

async function serviceActive(runtime: DockerRuntime, kind: DockerKind): Promise<boolean | null> {
  const args =
    kind === "rootless"
      ? ["--user", "is-active", DOCKER_SERVICE]
      : kind === "desktop"
        ? ["--user", "is-active", DOCKER_DESKTOP_USER_SERVICE]
        : ["is-active", DOCKER_SERVICE];
  const result = await runQuiet(runtime, "systemctl", args);
  return parseServiceState(result.code, result.stdout);
}

export async function readGroupMembership(runtime: DockerRuntime, group = DOCKER_GROUP): Promise<{ current: boolean; configured: boolean }> {
  const [groups, entry] = await Promise.all([runQuiet(runtime, "id", ["-nG"]), runQuiet(runtime, "getent", ["group", group])]);
  const user = runtime.host.user;
  const current = user === "root" || parseGroups(groups.stdout).includes(group);
  return { current, configured: current || parseGetentMembers(entry.stdout).includes(user) };
}

async function linuxExtras(runtime: DockerRuntime, kind: DockerKind) {
  const gid = runtime.system.socketGid(DOCKER_SOCKET);
  const [socketGroup, membership] = await Promise.all([
    gid === null ? Promise.resolve(null) : runQuiet(runtime, "getent", ["group", String(gid)]).then((r) => parseGetentName(r.stdout)),
    readGroupMembership(runtime),
  ]);
  const group = socketGroup && socketGroup !== "root" && socketGroup !== DOCKER_GROUP ? await readGroupMembership(runtime, socketGroup) : membership;
  const systemd = runtime.system.exists(SYSTEMD_RUN_DIR);
  return {
    linux: {
      inDockerGroup: group.current,
      socketGroup,
      systemd,
      serviceActive: systemd ? await serviceActive(runtime, kind) : null,
    },
    configuredInGroup: group.configured,
  };
}

async function windowsExtras(runtime: DockerRuntime) {
  const [wsl, virtualization] = await Promise.all([readWslVersion(runtime), readVirtualization(runtime)]);
  return { wsl, virtualization, desktopExe: firstExisting(runtime, windowsDesktopExeCandidates(runtime.env, runtime.host.home)) };
}

export async function readMacVersion(runtime: DockerRuntime): Promise<string | null> {
  const result = await runQuiet(runtime, "sw_vers", ["-productVersion"]);
  return result.code === 0 ? cleanVersion(result.stdout) : null;
}

export function platformBlock(runtime: DockerRuntime, macVersion: string | null, minMac = MIN_MAC_OS_VERSION): string | null {
  if (runtime.host.platform === "win32") {
    const build = windowsBuild(runtime.host.release);
    return build !== null && !isSupportedWindowsBuild(build) ? PLATFORM_MESSAGES.windowsTooOld : null;
  }
  if (runtime.host.platform === "darwin" && macVersion && !isAtLeast(macVersion, minMac)) return PLATFORM_MESSAGES.macTooOld(minMac);
  return null;
}

function resolveKind(
  runtime: DockerRuntime,
  cli: { podman: boolean } | null,
  daemon: DaemonState,
  info: InfoSummary | null,
  desktopInstalled: boolean,
): DockerKind {
  if (!cli) return "unknown";
  if (cli.podman || daemon.server?.podman || info?.podman) return "podman";
  if (info?.desktop) return "desktop";
  if (info?.rootless) return "rootless";
  const fromContext = kindFromContext(daemon.context);
  if (fromContext) return fromContext;
  if (runtime.host.platform === "linux") return "engine";
  return desktopInstalled ? "desktop" : "unknown";
}

export async function collectReport(runtime: DockerRuntime): Promise<DockerReport> {
  const platform = runtime.host.platform;
  const cliPath = dockerBinary(runtime);
  const cliVersion = cliPath ? await readCli(runtime, cliPath) : null;
  const daemon: DaemonState = cliPath
    ? await readDaemon(runtime, cliPath)
    : { daemon: "unknown", daemonError: null, context: null, server: null };
  const [info, context] = cliPath
    ? await Promise.all([
        daemon.daemon === "reachable" ? readInfo(runtime, cliPath) : Promise.resolve(null),
        daemon.context ? Promise.resolve(daemon.context) : readContext(runtime, cliPath),
      ])
    : [null, null];
  daemon.context = context;
  const [compose, buildx] = cliPath
    ? await Promise.all([info?.compose ?? readCompose(runtime, cliPath), info?.buildx ?? readBuildx(runtime, cliPath)])
    : [null, null];

  const macApp = platform === "darwin" ? firstExisting(runtime, macDesktopAppCandidates(runtime.host.home)) : null;
  const windows = platform === "win32" ? await windowsExtras(runtime) : undefined;
  const macVersion = platform === "darwin" ? await readMacVersion(runtime) : null;
  const kind = resolveKind(runtime, cliVersion, daemon, info, Boolean(macApp ?? windows?.desktopExe));
  const linuxResult = platform === "linux" && cliPath ? await linuxExtras(runtime, kind) : null;

  const server: DockerServerInfo | null =
    daemon.server && daemon.daemon === "reachable"
      ? {
          version: daemon.server.version,
          os: daemon.server.os,
          arch: daemon.server.arch,
          ncpu: info?.ncpu ?? 0,
          memBytes: info?.memBytes ?? 0,
          rootDir: info?.rootDir ?? "",
          rootless: info?.rootless ?? kind === "rootless",
        }
      : null;

  const report: DockerReport = {
    cli: cliPath ? { path: cliPath, version: cliVersion?.version ?? "" } : null,
    daemon: daemon.daemon,
    daemonError: daemon.daemonError,
    kind,
    context,
    server,
    compose,
    buildx,
    ...(linuxResult ? { linux: linuxResult.linux } : {}),
    ...(windows ? { windows } : {}),
    ...(platform === "darwin" ? { mac: { desktopApp: macApp, minOs: MIN_MAC_OS_VERSION } } : {}),
    checks: [],
  };
  report.checks = buildChecks(report, {
    platform,
    user: runtime.host.user,
    configuredInGroup: linuxResult?.configuredInGroup ?? false,
    platformBlock: platformBlock(runtime, macVersion),
  });
  return report;
}

export async function probeDocker(options: DockerRunOptions = {}): Promise<DockerReport> {
  const runtime = createRuntime(options);
  const report = await collectReport(runtime);
  runtime.report(report);
  return report;
}
