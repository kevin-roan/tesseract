import { readFileSync, statfsSync } from "node:fs";
import { availableParallelism, freemem, loadavg, totalmem } from "node:os";
import type { SandboxCounts, SandboxResources, SandboxStatus } from "@tesseract/protocol";
import type { Config } from "../config";
import type { DisplayService } from "./display";
import type { ToolService } from "./tools";

const CGROUP_ROOT = "/sys/fs/cgroup";

function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function meminfo(): { total: number; available: number } | null {
  const text = readText("/proc/meminfo");
  if (!text) return null;
  const value = (key: string) => {
    const match = new RegExp(`^${key}:\\s+(\\d+) kB`, "m").exec(text);
    return match ? Number(match[1]) * 1024 : null;
  };
  const total = value("MemTotal");
  const available = value("MemAvailable");
  return total !== null && available !== null ? { total, available } : null;
}

/** cgroup v2 limits, so a memory-capped container reports its own budget rather than the host's. */
function cgroupMemory(): { total: number; used: number } | null {
  const max = readText(`${CGROUP_ROOT}/memory.max`)?.trim();
  const current = readText(`${CGROUP_ROOT}/memory.current`)?.trim();
  if (!max || max === "max" || !current) return null;
  const inactive = /^inactive_file (\d+)$/m.exec(readText(`${CGROUP_ROOT}/memory.stat`) ?? "");
  const used = Math.max(0, Number(current) - Number(inactive?.[1] ?? 0));
  return Number.isFinite(Number(max)) ? { total: Number(max), used } : null;
}

function cpuCores(): number {
  const cores = availableParallelism();
  const [quota, period] = (readText(`${CGROUP_ROOT}/cpu.max`) ?? "").trim().split(/\s+/);
  if (!quota || quota === "max" || !period) return cores;
  const limit = Math.ceil(Number(quota) / Number(period));
  return Number.isFinite(limit) && limit > 0 ? Math.min(cores, limit) : cores;
}

function loads(): [number, number, number] {
  const parts = readText("/proc/loadavg")?.trim().split(/\s+/).slice(0, 3).map(Number);
  if (parts && parts.length === 3 && parts.every(Number.isFinite)) return parts as [number, number, number];
  const [a = 0, b = 0, c = 0] = loadavg();
  return [a, b, c];
}

export function readResources(diskPath: string): SandboxResources {
  const [load1, load5, load15] = loads();
  const cgroup = cgroupMemory();
  const host = meminfo();
  const hostTotal = host?.total ?? totalmem();
  const hostUsed = host ? host.total - host.available : totalmem() - freemem();
  const memory = cgroup && cgroup.total < hostTotal ? { totalBytes: cgroup.total, usedBytes: Math.min(cgroup.used, cgroup.total) } : { totalBytes: hostTotal, usedBytes: hostUsed };
  let disk = { path: diskPath, totalBytes: 0, usedBytes: 0 };
  try {
    const fs = statfsSync(diskPath);
    disk = { path: diskPath, totalBytes: fs.blocks * fs.bsize, usedBytes: (fs.blocks - fs.bfree) * fs.bsize };
  } catch {}
  return {
    cpu: { cores: cpuCores(), load1, load5, load15 },
    memory: { totalBytes: Math.round(memory.totalBytes), usedBytes: Math.max(0, Math.round(memory.usedBytes)) },
    disk,
  };
}

export class StatusService {
  private readonly startedAt = new Date();

  constructor(
    private readonly config: Config,
    private readonly version: string,
    private readonly tools: ToolService,
    private readonly display: DisplayService,
    private readonly counts: () => SandboxCounts,
  ) {}

  async status(): Promise<SandboxStatus> {
    const [display, tools] = await Promise.all([this.display.status(), this.tools.list()]);
    return {
      sandboxId: this.config.sandboxId,
      hostname: this.config.hostname,
      version: this.version,
      startedAt: this.startedAt.toISOString(),
      uptimeSec: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      resources: readResources(this.config.workspace),
      display,
      tools,
      counts: this.counts(),
    };
  }
}
