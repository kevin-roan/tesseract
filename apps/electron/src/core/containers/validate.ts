import type { CloudflareZone } from "../../shared/contracts/containers";
import { IpcError } from "../../shared/ipc-types";
import { HOST_LABEL, LIMITS, NAME_PATTERN, RESERVED_NAMES } from "./constants";
import { CONTAINERS_MESSAGES } from "./labels";

export function validName(name: unknown): string {
  const value = typeof name === "string" ? name.trim().toLowerCase() : "";
  if (!NAME_PATTERN.test(value)) throw new IpcError("invalid_argument", CONTAINERS_MESSAGES.invalidName);
  if (RESERVED_NAMES.includes(value)) throw new IpcError("invalid_argument", CONTAINERS_MESSAGES.reservedName(value));
  return value;
}

function inRange(value: number | null | undefined, min: number, max: number, message: string): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < min || value > max) throw new IpcError("invalid_argument", message);
  return value;
}

export function validCpus(value: number | null | undefined): number | null {
  return inRange(value, LIMITS.cpus.min, LIMITS.cpus.max, CONTAINERS_MESSAGES.invalidCpus);
}

export function validMemory(value: number | null | undefined): number | null {
  const memory = inRange(value, LIMITS.memoryMb.min, LIMITS.memoryMb.max, CONTAINERS_MESSAGES.invalidMemory);
  return memory === null ? null : Math.round(memory);
}

export function validPort(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new IpcError("invalid_argument", CONTAINERS_MESSAGES.invalidPort);
  }
  return value;
}

export function validHostname(value: unknown): string {
  const hostname = typeof value === "string" ? value.trim().toLowerCase().replace(/\.$/, "") : "";
  const labels = hostname.split(".");
  const ok = hostname.length <= LIMITS.hostname && labels.length >= 2 && labels.every((label) => HOST_LABEL.test(label)) && !/^\d+$/.test(labels.at(-1) ?? "");
  if (!ok) throw new IpcError("invalid_argument", CONTAINERS_MESSAGES.invalidHostname);
  return hostname;
}

export function zoneFor(hostname: string, zones: readonly CloudflareZone[]): CloudflareZone {
  const match = zones
    .filter((zone) => hostname === zone.name || hostname.endsWith(`.${zone.name}`))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (!match) throw new IpcError("invalid_argument", CONTAINERS_MESSAGES.noZone(hostname));
  return match;
}
