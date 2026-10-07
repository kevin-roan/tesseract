import type { DockerReport } from "../../../../shared/contracts/docker";
import type { BuildPhase, SandboxComponent, SandboxStackConfig, SandboxStackStatus } from "../../../../shared/contracts/sandbox";
import type { Tone } from "../../../theme/colors";
import { orderedComponents } from "../../../onboarding/sandbox/model";
import { BUILD_LOG_LIMIT, BYTES_PER_GB, RUNNING_STATE } from "./constants";
import { SANDBOX_SETTINGS_LABELS } from "./labels";

const L = SANDBOX_SETTINGS_LABELS;

export interface Badge {
  label: string;
  tone: Tone;
}

export function dockerBadge(report: DockerReport | null): Badge {
  if (!report) return { label: L.docker.badge.checking, tone: "neutral" };
  if (!report.cli) return { label: L.docker.badge.missing, tone: "danger" };
  switch (report.daemon) {
    case "reachable":
      return { label: L.docker.badge.running, tone: "success" };
    case "stopped":
      return { label: L.docker.badge.stopped, tone: "warning" };
    case "permission":
      return { label: L.docker.badge.permission, tone: "danger" };
    case "unresponsive":
      return { label: L.docker.badge.unresponsive, tone: "danger" };
    default:
      return { label: L.docker.badge.checking, tone: "neutral" };
  }
}

export function dockerReady(report: DockerReport | null): boolean {
  return report?.cli != null && report.daemon === "reachable";
}

export function dockerSubtitle(report: DockerReport | null): string {
  if (!report) return L.docker.checking;
  if (!report.cli) return L.docker.notInstalled;
  if (report.daemon !== "reachable" && report.daemonError) return report.daemonError;
  const name = `${L.docker.kinds[report.kind]} ${report.server?.version ?? report.cli.version}`;
  if (!report.server) return name;
  const memGb = (report.server.memBytes / BYTES_PER_GB).toFixed(0);
  return `${name}${L.separator}${L.docker.resources(report.server.ncpu, memGb)}`;
}

export function stackBadge(status: SandboxStackStatus | null): Badge {
  if (!status || !status.configured) return { label: L.stack.badge.unconfigured, tone: "neutral" };
  const running = status.services.filter((service) => service.state === RUNNING_STATE).length;
  if (running === 0) return { label: L.stack.badge.stopped, tone: "neutral" };
  if (running < status.services.length) return { label: L.stack.badge.partial, tone: "warning" };
  return { label: L.stack.badge.running, tone: "success" };
}

export function stackRunning(status: SandboxStackStatus | null): boolean {
  return status?.services.some((service) => service.state === RUNNING_STATE) ?? false;
}

export function stackSubtitle(status: SandboxStackStatus | null, stack: SandboxStackConfig | null): string | undefined {
  const project = status?.project ?? stack?.project;
  if (!project) return undefined;
  return L.stack.project(project, status?.services.length ?? 0);
}

export function imageSubtitle(stack: SandboxStackConfig, formatWhen: (iso: string) => string): string {
  return stack.builtAt ? L.stack.built(stack.image, formatWhen(stack.builtAt)) : L.stack.notBuilt(stack.image);
}

export function toggleComponent(components: readonly SandboxComponent[], component: SandboxComponent, on: boolean): SandboxComponent[] {
  const without = components.filter((item) => item !== component);
  return orderedComponents(on ? [...without, component] : without);
}

export function sameComponents(a: readonly SandboxComponent[], b: readonly SandboxComponent[]): boolean {
  const left = orderedComponents(a);
  const right = orderedComponents(b);
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

const ACTIVE_PHASES: ReadonlySet<BuildPhase["kind"]> = new Set(["preflight", "building", "pulling", "starting", "waiting", "pairing"]);

export function buildActive(phase: BuildPhase): boolean {
  return ACTIVE_PHASES.has(phase.kind);
}

export function appendLog(lines: readonly string[], line: string): string[] {
  const next = [...lines, line];
  return next.length > BUILD_LOG_LIMIT ? next.slice(next.length - BUILD_LOG_LIMIT) : next;
}

export function lastFraction(previous: number, phase: BuildPhase): number {
  if ((phase.kind === "building" || phase.kind === "pulling") && phase.fraction !== null) return phase.fraction;
  return previous;
}
