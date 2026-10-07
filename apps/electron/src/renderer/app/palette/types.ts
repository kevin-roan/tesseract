import type { LucideIcon } from "lucide-react";
import type { IconName } from "../../theme/icons";

export interface PaletteCommand {
  id: string;
  title: string;
  group: string;
  icon?: IconName;
  glyph?: LucideIcon;
  subtitle?: string;
  keywords?: readonly string[];
  shortcut?: string;
  run(): void;
}

export type MatchRange = readonly [start: number, end: number];

export interface PaletteResult {
  command: PaletteCommand;
  score: number;
  ranges: MatchRange[];
}

export interface PaletteSection {
  group: string;
  results: PaletteResult[];
}
