import { posix } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { parse } from "yaml";
import type { VmSize } from "../../shared/contracts/vm";
import {
  COLIMA_CONFIG_FILE,
  COLIMA_DIR,
  COLIMA_HOME_ENV,
  MANAGED_MARKER,
  SYSBOX_RUNC_PATH,
  SYSBOX_RUNTIME,
  VM_DEFAULT_SIZE,
  VM_PROFILE,
} from "./constants";
import { sysboxProvisionScript } from "./provision";

export type VmArch = "aarch64" | "x86_64";

export interface ColimaConfigInput {
  arch: VmArch;
  size: VmSize;
  home: string;
  resourcesDir: string;
}

export interface VmMount {
  location: string;
  writable: boolean;
}

export function vmArch(hostArch: string): VmArch {
  return hostArch === "arm64" ? "aarch64" : "x86_64";
}

export function colimaHome(env: NodeJS.ProcessEnv, home: string): string {
  return env[COLIMA_HOME_ENV] || posix.join(home, COLIMA_DIR);
}

export function colimaConfigPath(env: NodeJS.ProcessEnv, home: string): string {
  return posix.join(colimaHome(env, home), VM_PROFILE, COLIMA_CONFIG_FILE);
}

export function resolveSize(size: Partial<VmSize> = {}): VmSize {
  return { ...VM_DEFAULT_SIZE, ...size };
}

function isInside(path: string, dir: string): boolean {
  const relative = posix.relative(dir, path);
  return relative === "" || (!relative.startsWith("..") && !posix.isAbsolute(relative));
}

export function vmMounts(home: string, resourcesDir: string): VmMount[] {
  const mounts = [{ location: home, writable: true }];
  if (resourcesDir && !isInside(resourcesDir, home)) mounts.push({ location: resourcesDir, writable: false });
  return mounts;
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function indent(text: string, spaces: number): string[] {
  const pad = " ".repeat(spaces);
  return text.split("\n").map((line) => (line ? pad + line : line));
}

export function colimaConfig(input: ColimaConfigInput): string {
  const rosetta = input.arch === "aarch64";
  return [
    `# Written by Tesseract. Colima drops comments when it rewrites this file; Tesseract recognises it by the ${MANAGED_MARKER} marker in the provision script. Remove that marker to keep your own edits.`,
    `cpu: ${input.size.cpus}`,
    `disk: ${input.size.diskGb}`,
    `memory: ${input.size.memoryGb}`,
    `arch: ${input.arch}`,
    "runtime: docker",
    "hostname: null",
    "kubernetes:",
    "  enabled: false",
    "autoActivate: true",
    "network:",
    "  address: false",
    "  mode: shared",
    "  interface: en0",
    "  preferredRoute: false",
    "  dns: []",
    "  dnsHosts:",
    "    host.docker.internal: host.lima.internal",
    "  hostAddresses: false",
    "  gatewayAddress: 192.168.5.2",
    "forwardAgent: false",
    "docker:",
    "  runtimes:",
    `    ${SYSBOX_RUNTIME}:`,
    `      path: ${SYSBOX_RUNC_PATH}`,
    "vmType: vz",
    "portForwarder: ssh",
    `rosetta: ${rosetta}`,
    "binfmt: true",
    "nestedVirtualization: false",
    "mountType: virtiofs",
    "mountInotify: false",
    "provision:",
    "  - mode: system",
    "    script: |",
    ...indent(sysboxProvisionScript(), 6),
    "sshConfig: false",
    "mounts:",
    ...vmMounts(input.home, input.resourcesDir).flatMap((mount) => [
      `  - location: ${quote(mount.location)}`,
      `    writable: ${mount.writable}`,
    ]),
    "env: {}",
    "",
  ].join("\n");
}

interface ManagedFields {
  cpu: unknown;
  memory: unknown;
  disk: unknown;
  sshConfig: boolean;
  runtimes: unknown;
  provision: { mode: unknown; script: string }[];
  mounts: VmMount[];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function parseConfig(text: string): Record<string, unknown> | null {
  try {
    return record(parse(text));
  } catch {
    return null;
  }
}

function provisionScripts(data: Record<string, unknown>): ManagedFields["provision"] {
  return list(data.provision).map((entry) => ({ mode: entry.mode, script: String(entry.script ?? "").trimEnd() }));
}

function managedFields(text: string): ManagedFields | null {
  const data = parseConfig(text);
  if (!data) return null;
  return {
    cpu: data.cpu,
    memory: data.memory,
    disk: data.disk,
    sshConfig: data.sshConfig === true,
    runtimes: record(data.docker).runtimes ?? null,
    provision: provisionScripts(data),
    mounts: list(data.mounts).map((mount) => ({ location: String(mount.location), writable: mount.writable === true })),
  };
}

export function isManagedConfig(text: string): boolean {
  const data = parseConfig(text);
  return Boolean(data && provisionScripts(data).some((entry) => entry.script.includes(MANAGED_MARKER)));
}

export function sameManagedConfig(current: string, next: string): boolean {
  const a = managedFields(current);
  return a !== null && isDeepStrictEqual(a, managedFields(next));
}

function topLevelNumber(text: string, key: string): number | null {
  const match = new RegExp(`^${key}:\\s*(\\d+)\\s*$`, "m").exec(text);
  return match ? Number(match[1]) : null;
}

export function configSize(text: string | null): VmSize {
  if (!text) return VM_DEFAULT_SIZE;
  return {
    cpus: topLevelNumber(text, "cpu") ?? VM_DEFAULT_SIZE.cpus,
    memoryGb: topLevelNumber(text, "memory") ?? VM_DEFAULT_SIZE.memoryGb,
    diskGb: topLevelNumber(text, "disk") ?? VM_DEFAULT_SIZE.diskGb,
  };
}
