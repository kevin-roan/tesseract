import type { ListeningPort, ProcessCommand, ProcessInfo, Project, StartProcess } from "@theone/protocol";
import type { RecordStatus } from "../../../../components/RecordRow";
import { elapsedSeconds, formatDuration, formatRelativeTime, joinMeta } from "../../../../features/projects/format";
import { isLiveProcess, prefersDisplay } from "../../../../features/projects/model";
import { DEFAULT_PACKAGE_MANAGER, PROCESS_TONES, SHELL_SAFE_WORD } from "./constants";
import { PROCESSES_LABELS as L } from "./labels";

export function processName(process: Pick<ProcessInfo, "id" | "name">): string {
  return process.name || process.id;
}

export function commandLabel(command: ProcessCommand): string {
  return typeof command === "string" ? command : command.join(" ");
}

export function processStatus(process: Pick<ProcessInfo, "state" | "exitCode">): RecordStatus {
  if (process.state === "exited" && process.exitCode !== null && process.exitCode !== 0) {
    return { label: L.states.failed, tone: "danger", glyph: true };
  }
  return { label: L.states[process.state] ?? process.state, tone: PROCESS_TONES[process.state] ?? "neutral", glyph: true };
}

export function processMeta(process: ProcessInfo, now = Date.now()): string {
  const started = formatRelativeTime(process.startedAt, now);
  const extras: string[] = [];
  if (process.port) extras.push(L.port(process.port));
  if (process.display) extras.push(L.display);
  if (isLiveProcess(process)) {
    if (process.pid) extras.push(L.pid(process.pid));
    return joinMeta(L.metaRunning(started), ...extras);
  }
  const seconds = elapsedSeconds(process.startedAt, process.endedAt, now);
  const ended = formatRelativeTime(process.endedAt, now) || started;
  if (process.exitCode !== null && process.exitCode !== undefined) extras.push(L.exit(process.exitCode));
  return joinMeta(L.metaEnded(seconds === null ? "" : formatDuration(seconds), ended), ...extras);
}

export function projectPorts(ports: readonly ListeningPort[] | null | undefined, projectId: string): ListeningPort[] {
  return (ports ?? []).filter((port) => port.projectId === projectId).sort((a, b) => a.port - b.port);
}

export function hostOf(baseUrl: string | null | undefined): string | null {
  if (!baseUrl) return null;
  try {
    return new URL(baseUrl).hostname.replace(/^\[|\]$/g, "") || null;
  } catch {
    return null;
  }
}

export function portUrl(port: ListeningPort, fallbackHost: string | null): string | null {
  if (port.url) return port.url;
  if (port.dnsUrl) return port.dnsUrl;
  if (!fallbackHost) return null;
  const host = fallbackHost.includes(":") ? `[${fallbackHost}]` : fallbackHost;
  return `http://${host}:${port.port}`;
}

export function packageManager(project: Pick<Project, "packageManager">): string {
  return project.packageManager || DEFAULT_PACKAGE_MANAGER;
}

export function shellWord(value: string): string {
  if (SHELL_SAFE_WORD.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function scriptCommand(pm: string, script: string): string {
  return `${pm} run ${shellWord(script)}`;
}

export function scriptRequest(project: Project, script: string, forceDisplay: boolean): StartProcess {
  const body: StartProcess = { projectId: project.id, command: scriptCommand(packageManager(project), script), name: script };
  if (forceDisplay || prefersDisplay(project.framework)) body.display = true;
  return body;
}
