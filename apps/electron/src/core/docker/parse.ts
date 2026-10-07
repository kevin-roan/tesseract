import type { DockerDaemon, DockerKind } from "../../shared/contracts/docker";
import {
  DAEMON_PERMISSION_MARKERS,
  DAEMON_SOCKET_MARKER,
  GIB,
  KNOWN_CONTEXT_KINDS,
  MIN_WIN10_BUILD,
  MIN_WIN11_BUILD,
  WIN11_FIRST_BUILD,
} from "./constants";

export interface ServerVersion {
  version: string;
  os: string;
  arch: string;
  podman: boolean;
}

export interface InfoSummary {
  desktop: boolean;
  rootless: boolean;
  podman: boolean;
  ncpu: number;
  memBytes: number;
  rootDir: string;
  compose: string | null;
  buildx: string | null;
}

export interface OsRelease {
  id: string;
  idLike: string[];
  versionId: string;
  prettyName: string;
}

export function cleanVersion(raw: string | null | undefined): string | null {
  const match = raw?.trim().match(/^v?(\d+(?:\.\d+)*)/);
  return match?.[1] ?? null;
}

export function compareVersions(a: string, b: string): number {
  const left = a.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = b.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

export function isAtLeast(version: string, minimum: string): boolean {
  return compareVersions(version, minimum) >= 0;
}

export function parseCliVersion(stdout: string): { version: string; podman: boolean } | null {
  const text = stdout.trim();
  const podman = /^podman\b/i.test(text);
  const match = text.match(/version\s+v?(\d+(?:\.\d+)*)/i);
  return match?.[1] ? { version: match[1], podman } : null;
}

function parseJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  try {
    const value: unknown = JSON.parse(text.slice(start));
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function parseVersionJson(stdout: string): { server: ServerVersion | null; context: string | null } {
  const data = parseJson(stdout);
  if (!data) return { server: null, context: null };
  const client = record(data.Client);
  const context = text(client.Context) || null;
  if (!data.Server) return { server: null, context };
  const server = record(data.Server);
  const components = Array.isArray(server.Components) ? server.Components : [];
  const podman = components.some((component) => /podman/i.test(text(record(component).Name)));
  return {
    server: { version: cleanVersion(text(server.Version)) ?? text(server.Version), os: text(server.Os), arch: text(server.Arch), podman },
    context,
  };
}

export function classifyDaemonError(stderr: string, timedOut: boolean): DockerDaemon {
  if (timedOut) return "unresponsive";
  const lower = stderr.toLowerCase();
  if (DAEMON_PERMISSION_MARKERS.some((marker) => lower.includes(marker)) && lower.includes(DAEMON_SOCKET_MARKER)) {
    return "permission";
  }
  return "stopped";
}

export function parseInfoJson(stdout: string): InfoSummary | null {
  const data = parseJson(stdout);
  if (!data) return null;
  const security = Array.isArray(data.SecurityOptions) ? data.SecurityOptions.map(text) : [];
  const plugins = Array.isArray(record(data.ClientInfo).Plugins) ? (record(data.ClientInfo).Plugins as unknown[]) : [];
  const plugin = (name: string) => {
    const found = plugins.map(record).find((entry) => text(entry.Name) === name);
    return found ? cleanVersion(text(found.Version)) : null;
  };
  const operatingSystem = text(data.OperatingSystem);
  return {
    desktop: /docker desktop/i.test(operatingSystem),
    rootless: security.some((option) => option.split(",").includes("name=rootless")),
    podman: /podman/i.test(operatingSystem),
    ncpu: typeof data.NCPU === "number" ? data.NCPU : 0,
    memBytes: typeof data.MemTotal === "number" ? data.MemTotal : 0,
    rootDir: text(data.DockerRootDir),
    compose: plugin("compose"),
    buildx: plugin("buildx"),
  };
}

export function parseBuildxVersion(stdout: string): string | null {
  const token = stdout.trim().split(/\s+/)[1];
  return cleanVersion(token);
}

export function decodeWslOutput(latin1: string): string {
  const bytes = Buffer.from(latin1, "latin1");
  const zeros = bytes.reduce((count, byte) => count + (byte === 0 ? 1 : 0), 0);
  return zeros > bytes.length / 4 ? bytes.toString("utf16le") : bytes.toString("utf8");
}

export function parseWslVersion(stdout: string): string | null {
  const firstLine = stdout
    .replace(/\u0000/g, "")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine?.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/)?.[1] ?? null;
}

export function parseVirtualization(stdout: string): boolean | null {
  const values = stdout
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line === "true" || line === "false");
  if (values.length === 0) return null;
  return values.includes("true");
}

export function parseOsRelease(content: string): OsRelease {
  const values: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match?.[1]) continue;
    values[match[1]] = (match[2] ?? "").trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  const id = (values.ID ?? "linux").toLowerCase();
  return {
    id,
    idLike: (values.ID_LIKE ?? "").toLowerCase().split(/\s+/).filter(Boolean),
    versionId: values.VERSION_ID ?? "",
    prettyName: values.PRETTY_NAME ?? values.NAME ?? id,
  };
}

export function parseChecksums(content: string, fileName: string): string | null {
  for (const line of content.split(/\r?\n/)) {
    const match = line.trim().match(/^([a-f0-9]{64})\s+\*?(.+)$/i);
    if (match?.[1] && match[2]?.trim() === fileName) return match[1].toLowerCase();
  }
  return null;
}

export function parseMinimumSystemVersion(appcast: string): string | null {
  const element = appcast.match(/<sparkle:minimumSystemVersion>\s*([\d.]+)\s*</);
  if (element?.[1]) return element[1];
  return appcast.match(/sparkle:minimumSystemVersion="([\d.]+)"/)?.[1] ?? null;
}

export function windowsBuild(release: string): number | null {
  const build = release.split(".")[2];
  const value = build ? Number.parseInt(build, 10) : Number.NaN;
  return Number.isFinite(value) ? value : null;
}

export function isSupportedWindowsBuild(build: number): boolean {
  return build >= WIN11_FIRST_BUILD ? build >= MIN_WIN11_BUILD : build >= MIN_WIN10_BUILD;
}

export function kindFromContext(context: string | null): DockerKind | null {
  if (!context) return null;
  return (KNOWN_CONTEXT_KINDS as Record<string, DockerKind>)[context] ?? null;
}

export function parseGroups(stdout: string): string[] {
  return stdout.trim().split(/\s+/).filter(Boolean);
}

export function parseGetentMembers(stdout: string): string[] {
  const members = stdout.trim().split(":")[3] ?? "";
  return members.split(",").map((member) => member.trim()).filter(Boolean);
}

export function parseGetentName(stdout: string): string | null {
  return stdout.trim().split(":")[0] || null;
}

export function parseServiceState(code: number | null, stdout: string): boolean | null {
  const state = stdout.trim();
  if (state === "active" || state === "activating" || state === "reloading") return true;
  if (state === "inactive" || state === "failed" || state === "deactivating") return false;
  return code === 0 ? true : null;
}

export function formatGb(bytes: number): string {
  const value = bytes / GIB;
  return value >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
}
