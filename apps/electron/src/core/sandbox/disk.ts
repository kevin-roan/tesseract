import { dirname } from "node:path";
import type { DockerReport } from "../../shared/contracts/docker";
import type { SandboxComponent } from "../../shared/contracts/sandbox";
import { BASE_IMAGE_GB, COMPONENT_SIZE_GB, DISK_BASE_GB, DISK_ROUND_GB, GB } from "./constants";
import type { SandboxDeps } from "./types";

export type DiskCheck =
  | { kind: "ok"; path: string; freeGb: number; needGb: number }
  | { kind: "low"; path: string; freeGb: number; needGb: number }
  | { kind: "vm"; needGb: number }
  | { kind: "unknown"; needGb: number };

export function diskRequirementGb(components: readonly SandboxComponent[]): number {
  const extras = components.reduce((sum, component) => sum + COMPONENT_SIZE_GB[component], 0);
  const raw = DISK_BASE_GB + 2 * extras + 2 * BASE_IMAGE_GB;
  return Math.ceil(raw / DISK_ROUND_GB - 1e-9) * DISK_ROUND_GB;
}

export function measuresHostDisk(report: DockerReport | null, platform: NodeJS.Platform): boolean {
  if (platform !== "linux" || !report?.server?.rootDir) return false;
  return report.kind === "engine" || report.kind === "rootless";
}

async function nearestFree(deps: Pick<SandboxDeps, "freeBytes">, path: string): Promise<{ path: string; free: number } | null> {
  let current = path;
  for (;;) {
    try {
      return { path: current, free: await deps.freeBytes(current) };
    } catch {
      const parent = dirname(current);
      if (parent === current) return null;
      current = parent;
    }
  }
}

export async function checkDiskSpace(
  deps: Pick<SandboxDeps, "freeBytes" | "platform">,
  report: DockerReport | null,
  components: readonly SandboxComponent[],
): Promise<DiskCheck> {
  const needGb = diskRequirementGb(components);
  if (!measuresHostDisk(report, deps.platform)) return { kind: "vm", needGb };
  const found = await nearestFree(deps, report?.server?.rootDir as string);
  if (!found) return { kind: "unknown", needGb };
  const freeGb = Math.floor((found.free / GB) * 10) / 10;
  return { kind: found.free >= needGb * GB ? "ok" : "low", path: found.path, freeGb, needGb };
}
