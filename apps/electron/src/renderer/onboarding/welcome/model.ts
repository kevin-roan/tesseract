import type { HostInfo } from "../../../shared/contracts/onboarding";
import type { CheckRowStatus } from "../shell";
import { BYTES_PER_GB, BYTES_PER_TB, DISK_RECOMMENDED_BYTES, MEMORY_RECOMMENDED_BYTES, NO_EMULATOR_HOSTS } from "./constants";
import { WELCOME_LABELS } from "./labels";

export interface RequirementCheck {
  id: "disk" | "memory" | "processor";
  title: string;
  subtitle: string;
  status: CheckRowStatus;
}

const LABELS = WELCOME_LABELS.checks;

function trimDecimal(value: number): string {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return String(rounded);
}

export function formatSize(bytes: number): string {
  if (bytes >= BYTES_PER_TB) return `${trimDecimal(bytes / BYTES_PER_TB)} TB`;
  return `${trimDecimal(bytes / BYTES_PER_GB)} GB`;
}

export function formatMemoryGb(bytes: number): string {
  return String(Math.round(bytes / BYTES_PER_GB));
}

function diskCheck(host: HostInfo): RequirementCheck {
  const base = { id: "disk" as const, title: LABELS.disk };
  if (host.freeDiskBytes === null) return { ...base, status: "pending", subtitle: LABELS.diskUnknown(host.homeDir) };
  const free = LABELS.diskFree(formatSize(host.freeDiskBytes), host.homeDir);
  if (host.freeDiskBytes < DISK_RECOMMENDED_BYTES) return { ...base, status: "warning", subtitle: `${free} · ${LABELS.diskLow}` };
  return { ...base, status: "ok", subtitle: free };
}

function memoryCheck(host: HostInfo): RequirementCheck {
  const base = { id: "memory" as const, title: LABELS.memory };
  const value = LABELS.memoryValue(formatMemoryGb(host.memBytes));
  if (host.memBytes < MEMORY_RECOMMENDED_BYTES) return { ...base, status: "warning", subtitle: `${value} · ${LABELS.memoryLow}` };
  return { ...base, status: "ok", subtitle: value };
}

function processorCheck(host: HostInfo): RequirementCheck {
  const base = { id: "processor" as const, title: LABELS.processor };
  const value = LABELS.processorValue(host.cpus, host.arch);
  if (NO_EMULATOR_HOSTS.includes(`${host.platform}/${host.arch}`)) {
    return { ...base, status: "warning", subtitle: `${value} · ${LABELS.processorNoEmulator}` };
  }
  return { ...base, status: "ok", subtitle: value };
}

export function requirementChecks(host: HostInfo | null, failed = false): RequirementCheck[] {
  if (!host) {
    const status: CheckRowStatus = failed ? "pending" : "running";
    const subtitle = failed ? LABELS.unknown : LABELS.checking;
    return [
      { id: "disk", title: LABELS.disk, subtitle, status },
      { id: "memory", title: LABELS.memory, subtitle, status },
      { id: "processor", title: LABELS.processor, subtitle, status },
    ];
  }
  return [diskCheck(host), memoryCheck(host), processorCheck(host)];
}
