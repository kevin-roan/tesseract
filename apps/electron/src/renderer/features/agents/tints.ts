import type { Project } from "@tesseract/protocol";
import { PROJECT_TINTS } from "../../theme/palettes";
import { FRAMEWORK_LOGOS } from "./constants";

export interface ProjectBadge {
  logo: string | null;
  tint: number | null;
}

export const NO_PROJECT_BADGE: ProjectBadge = { logo: null, tint: null };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(text: string): number {
  let crc = 0xffffffff;
  for (const byte of new TextEncoder().encode(text)) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function projectTint(projectId: string): number {
  return crc32(projectId) % PROJECT_TINTS.length;
}

export function frameworkLogo(framework: string | null | undefined): string | null {
  return FRAMEWORK_LOGOS[framework ?? "unknown"] ?? null;
}

export function projectBadges(projects: readonly Pick<Project, "id" | "framework">[] | null | undefined): Record<string, ProjectBadge> {
  const badges: Record<string, ProjectBadge> = {};
  const taken = new Set<number>();
  const sorted = [...(projects ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const project of sorted) {
    let tint = projectTint(project.id);
    for (let step = 0; step < PROJECT_TINTS.length; step += 1) {
      const candidate = (tint + step) % PROJECT_TINTS.length;
      if (!taken.has(candidate)) {
        tint = candidate;
        break;
      }
    }
    taken.add(tint);
    badges[project.id] = { logo: frameworkLogo(project.framework), tint };
  }
  return badges;
}

export function projectBadge(projectId: string | null | undefined, badges: Readonly<Record<string, ProjectBadge>>): ProjectBadge {
  if (!projectId) return NO_PROJECT_BADGE;
  return badges[projectId] ?? { logo: null, tint: projectTint(projectId) };
}
