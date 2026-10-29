import type { HostToolchain, HostToolchainCandidate, HostToolchainSource } from "@tesseract/protocol";
import { REMOTE_ANDROID_LABELS as L } from "./labels";

export const AUTOMATIC = "automatic";
export const CUSTOM = "custom";

export interface ToolchainSection {
  configured: string | null;
  path: string | null;
  source: HostToolchainSource | null;
  candidates: HostToolchainCandidate[];
}

export interface ToolchainChoice {
  id: string;
  title: string;
  subtitle: string;
}

export interface ToolchainPick {
  choice: string;
  custom: string;
}

export type ToolchainKind = "android" | "java";

export const sectionOf = (toolchain: HostToolchain, kind: ToolchainKind): ToolchainSection => toolchain[kind];

function automaticSubtitle(section: ToolchainSection): string {
  if (section.configured === null && section.path && section.source) return L.automaticFound(section.path, L.sources[section.source]);
  return section.configured === null ? L.automaticNone : L.automatic;
}

/** Automatic, every folder the host found, then a free-form folder. */
export function toolchainChoices(section: ToolchainSection, kind: ToolchainKind): ToolchainChoice[] {
  const labels = L[kind];
  return [
    { id: AUTOMATIC, title: L.automatic, subtitle: automaticSubtitle(section) },
    ...section.candidates.map((candidate) => ({
      id: candidate.path,
      title: candidate.label,
      subtitle: `${candidate.path} · ${candidate.usable ? labels.usable : labels.unusable}`,
    })),
    { id: CUSTOM, title: L.custom, subtitle: L.customSubtitle },
  ];
}

export function savedPick(section: ToolchainSection): ToolchainPick {
  if (section.configured === null) return { choice: AUTOMATIC, custom: "" };
  if (section.candidates.some((candidate) => candidate.path === section.configured)) return { choice: section.configured, custom: "" };
  return { choice: CUSTOM, custom: section.configured };
}

/** null: back to automatic; undefined: nothing valid to save yet. */
export function pickedPath(pick: ToolchainPick): string | null | undefined {
  if (pick.choice === AUTOMATIC) return null;
  if (pick.choice !== CUSTOM) return pick.choice;
  const path = pick.custom.trim();
  return path ? path : undefined;
}

export function pickChanged(section: ToolchainSection, pick: ToolchainPick): boolean {
  const path = pickedPath(pick);
  return path !== undefined && path !== section.configured;
}

/** Nothing usable in effect: the folder in use is missing the tools, or there is none. */
export function toolchainMissing(section: ToolchainSection): boolean {
  if (!section.path) return true;
  return section.candidates.find((candidate) => candidate.path === section.path)?.usable === false;
}
