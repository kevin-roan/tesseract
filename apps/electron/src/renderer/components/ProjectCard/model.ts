import type { Tone } from "../../theme/colors";

export interface ToneLabel {
  label: string;
  tone: Tone;
}

export interface ProjectCardModel {
  id: string;
  title: string;
  subtitle?: string | null;
  activity: ToneLabel;
  branch?: string | null;
  sync?: string | null;
  dirty?: ToneLabel | null;
  commit?: string | null;
  commitWhen?: string | null;
  tags: readonly string[];
  confidential?: ToneLabel | null;
}

export function gridColumnTemplate(minWidth: number, gap: number, maxColumns: number): string {
  const columns = Math.max(1, Math.floor(maxColumns));
  if (columns === 1) return "minmax(0, 1fr)";
  return `repeat(auto-fill, minmax(max(${minWidth}px, (100% - ${(columns - 1) * gap}px) / ${columns}), 1fr))`;
}
