import type { BuildJob, BuildTarget, ListeningPort, LogLine, ProcessInfo, StartBuild, StartProcess } from "@tesseract/protocol";
import { sampleBuild, sampleProcess, samplePorts } from "@tesseract/protocol/fixtures";
import { BASE_IDS, CLONE_PROCESS_ID, REFERENCE_IDS, fixtureBuilds, fixtureProcesses } from "../projects/data";

export const SCENARIOS = {
  reference: "Reference ids (nimble-lotus has the two java ports of page-projects-tabs-processes.png)",
  busy: "A running Linux AppImage build on hybrid-pos (with streaming logs)",
} as const;

const TAILSCALE_IP = "100.116.96.29";
const JAVA_PORTS = [41653, 41769];
const STARTED_PID = 91_000;

export const PROTECTED_PROCESS_IDS: readonly string[] = [CLONE_PROCESS_ID];

const javaPort = (port: number, projectId: string, index: number): ListeningPort => ({
  port,
  pid: 52_000 + index,
  command: "java",
  processId: null,
  projectId,
  url: `http://${TAILSCALE_IP}:${port}`,
  dnsUrl: null,
});

export function fixturePorts(): { tailscaleIp: string; ports: ListeningPort[] } {
  const owners = [BASE_IDS.streaxfit, REFERENCE_IDS.streaxfit];
  const ports = owners.flatMap((owner) => JAVA_PORTS.map((port, index) => javaPort(port, owner, index)));
  return { tailscaleIp: TAILSCALE_IP, ports: [...ports, ...samplePorts.ports] };
}

export function allProcesses(): ProcessInfo[] {
  return [...fixtureProcesses(BASE_IDS), ...fixtureProcesses(REFERENCE_IDS)];
}

export function allBuilds(): BuildJob[] {
  return [...fixtureBuilds(BASE_IDS, true), ...fixtureBuilds(REFERENCE_IDS, true)];
}

const LOG_TEXT: Record<"process" | "build", readonly (readonly [LogLine["stream"], string])[]> = {
  process: [
    ["system", "$ pnpm run dev"],
    ["stdout", "Starting Metro Bundler"],
    ["stdout", "\u001b[32m›\u001b[0m Metro waiting on exp://100.116.96.29:8081"],
    ["stderr", "warning: Bundler cache is empty, rebuilding (this may take a minute)"],
    ["stdout", "Android Bundled 5321ms index.ts (1873 modules)"],
    ["stdout", "LOG  Running \"main\" with {\"rootTag\":11}"],
  ],
  build: [
    ["system", "$ bunx electron-builder --linux AppImage"],
    ["stdout", "  • electron-builder  version=26.0.12 os=6.8.0"],
    ["stdout", "  • packaging       platform=linux arch=x64 electron=44.5.1"],
    ["stderr", "  • downloading     url=https://github.com/electron/electron/releases"],
    ["stdout", "  • building        target=AppImage arch=x64 file=release/hybrid-pos-1.1.111.AppImage"],
  ],
};

export function logLines(kind: "process" | "build", startedAt = Date.now() - 60_000): LogLine[] {
  return LOG_TEXT[kind].map(([stream, text], index) => ({
    seq: index + 1,
    ts: new Date(startedAt + index * 1000).toISOString(),
    stream,
    text,
  }));
}

export function startedProcess(body: StartProcess): ProcessInfo {
  return {
    ...sampleProcess,
    id: `prc_fixture${Date.now().toString(36)}`,
    projectId: body.projectId,
    name: body.name ?? (typeof body.command === "string" ? body.command : body.command.join(" ")),
    command: body.command,
    cwd: `/workspace/projects/${body.projectId}`,
    pid: STARTED_PID,
    port: body.port ?? null,
    display: body.display ?? false,
    state: "starting",
    exitCode: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
  };
}

export function startedBuild(body: StartBuild): BuildJob {
  const now = new Date().toISOString();
  return {
    ...sampleBuild,
    id: `bld_fixture${Date.now().toString(36)}`,
    projectId: body.projectId,
    target: body.target as BuildTarget,
    profile: body.profile ?? "debug",
    state: "queued",
    stage: null,
    progress: null,
    createdAt: now,
    startedAt: null,
    endedAt: null,
    artifacts: [],
    error: null,
  };
}
