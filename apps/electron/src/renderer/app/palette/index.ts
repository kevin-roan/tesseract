export { CommandPalette } from "./CommandPalette";
export { PALETTE_LABELS } from "./labels";
export { flattenSections, highlightSegments, matchText, scoreCommand, searchCommands } from "./model";
export { registerPaletteCommands, usePaletteCommands, usePaletteRegistry } from "./registry";
export { closeCommandPalette, openCommandPalette, toggleCommandPalette, usePaletteStore } from "./store";
export type { MatchRange, PaletteCommand, PaletteResult, PaletteSection } from "./types";
