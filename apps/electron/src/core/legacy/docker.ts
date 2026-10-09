import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { IpcError } from "../../shared/ipc-types";
import { commandError, type CommandOptions, type CommandResult } from "../process";
import { DEFAULT_IMAGE, DEFAULT_PROJECT } from "../sandbox/constants";
import {
  COMPOSE_LABELS,
  COPY_IMAGE_FALLBACKS,
  COPY_SCRIPT,
  COPY_SHELL,
  MARKER_DIR_NAME,
  SKIP_MIGRATION_ENV,
  volumeMarkerName,
  DOCKER_DOWN_MS,
  DOCKER_QUICK_MS,
  LEGACY_IMAGE,
  LEGACY_PROJECT,
  VOLUME_COPY_MS,
  VOLUME_SUFFIXES,
} from "./constants";
import { LEGACY_LABELS } from "./labels";

export interface LegacyDockerDeps {
  run(file: string, args: readonly string[], options?: CommandOptions): Promise<CommandResult>;
}

export interface LegacyStackTarget {
  project: string;
  volumePrefix: string;
  image: string;
  env: NodeJS.ProcessEnv;
  hostEnv: NodeJS.ProcessEnv;
}

export interface LegacyDockerReport {
  stoppedLegacy: boolean;
  copiedVolumes: string[];
}

type Log = (line: string) => void;

function docker(deps: LegacyDockerDeps, target: LegacyStackTarget, args: string[], timeoutMs = DOCKER_QUICK_MS): Promise<CommandResult> {
  return deps.run("docker", args, { timeoutMs, env: target.env });
}

export function legacyStateDir(env: NodeJS.ProcessEnv): string {
  const base = env.XDG_STATE_HOME?.startsWith("/") ? env.XDG_STATE_HOME : join(env.HOME || homedir(), ".local", "state");
  return join(base, MARKER_DIR_NAME);
}

export function volumeMarker(target: Pick<LegacyStackTarget, "hostEnv" | "volumePrefix">): string {
  return join(legacyStateDir(target.hostEnv), volumeMarkerName(target.volumePrefix));
}

async function legacyContainers(deps: LegacyDockerDeps, target: LegacyStackTarget): Promise<string[]> {
  const result = await docker(deps, target, ["ps", "--quiet", "--filter", `label=${COMPOSE_LABELS.project}=${LEGACY_PROJECT}`]);
  if (result.code !== 0) return [];
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

async function stopLegacyProject(deps: LegacyDockerDeps, target: LegacyStackTarget, log: Log): Promise<boolean> {
  const ids = await legacyContainers(deps, target);
  if (ids.length === 0) return false;
  log(LEGACY_LABELS.stoppingLegacy(LEGACY_PROJECT));
  const downArgs = ["compose", "--project-name", LEGACY_PROJECT, "down", "--remove-orphans"];
  const down = await docker(deps, target, downArgs, DOCKER_DOWN_MS);
  if (down.code === 0) return true;
  const stop = await docker(deps, target, ["stop", ...ids], DOCKER_DOWN_MS);
  const removed = stop.code === 0 ? await docker(deps, target, ["rm", ...ids]) : stop;
  if (removed.code !== 0) {
    throw new IpcError("unavailable", LEGACY_LABELS.legacyDownFailed(LEGACY_PROJECT, commandError("docker", downArgs, down)));
  }
  return true;
}

async function imagePresent(deps: LegacyDockerDeps, target: LegacyStackTarget, image: string): Promise<boolean> {
  return (await docker(deps, target, ["image", "inspect", "--format", "{{.Id}}", image])).code === 0;
}

async function volumeExists(deps: LegacyDockerDeps, target: LegacyStackTarget, name: string): Promise<boolean> {
  return (await docker(deps, target, ["volume", "inspect", name])).code === 0;
}

async function copyImage(deps: LegacyDockerDeps, target: LegacyStackTarget): Promise<string | null> {
  for (const image of [...new Set([target.image, DEFAULT_IMAGE, LEGACY_IMAGE, ...COPY_IMAGE_FALLBACKS])]) {
    if (await imagePresent(deps, target, image)) return image;
  }
  return null;
}

// Docker cannot rename a volume: each one is copied and the old one removed right after, so a
// large workspace never sits on the disk twice.
async function moveVolumes(deps: LegacyDockerDeps, target: LegacyStackTarget, log: Log): Promise<string[]> {
  const copied: string[] = [];
  let image: string | null | undefined;
  for (const suffix of VOLUME_SUFFIXES) {
    const to = `${target.volumePrefix}-${suffix}`;
    const from = `${LEGACY_PROJECT}-${suffix}`;
    if (await volumeExists(deps, target, to)) continue;
    if (!(await volumeExists(deps, target, from))) continue;
    image ??= await copyImage(deps, target);
    if (!image) throw new IpcError("unavailable", LEGACY_LABELS.noCopyImage(from));
    log(LEGACY_LABELS.movingVolume(from, to));
    const labels = ["--label", `${COMPOSE_LABELS.project}=${target.project}`, "--label", `${COMPOSE_LABELS.volume}=${DEFAULT_PROJECT}-${suffix}`];
    const created = await docker(deps, target, ["volume", "create", ...labels, to]);
    if (created.code !== 0) throw new IpcError("unavailable", LEGACY_LABELS.copyFailed(from, to, commandError("docker", ["volume", "create", to], created)));
    const args = ["run", "--rm", "--network", "none", "--user", "0:0", "--entrypoint", COPY_SHELL, "-v", `${from}:/from:ro`, "-v", `${to}:/to`, image, "-c", COPY_SCRIPT];
    const result = await docker(deps, target, args, VOLUME_COPY_MS);
    if (result.code !== 0) {
      await docker(deps, target, ["volume", "rm", to]);
      throw new IpcError("unavailable", LEGACY_LABELS.copyFailed(from, to, commandError("docker", args, result)));
    }
    copied.push(to);
    if ((await docker(deps, target, ["volume", "rm", from])).code !== 0) log(LEGACY_LABELS.oldVolumeKept(from, to));
  }
  return copied;
}

export async function migrateLegacyStack(deps: LegacyDockerDeps, target: LegacyStackTarget, log: Log = () => undefined): Promise<LegacyDockerReport> {
  const report: LegacyDockerReport = { stoppedLegacy: false, copiedVolumes: [] };
  if (target.hostEnv[SKIP_MIGRATION_ENV] || target.project !== DEFAULT_PROJECT) return report;
  report.stoppedLegacy = await stopLegacyProject(deps, target, log);
  if (target.volumePrefix !== DEFAULT_PROJECT) return report;
  const marker = volumeMarker(target);
  if (existsSync(marker)) return report;
  report.copiedVolumes = await moveVolumes(deps, target, log);
  mkdirSync(join(marker, ".."), { recursive: true });
  writeFileSync(marker, "");
  return report;
}
