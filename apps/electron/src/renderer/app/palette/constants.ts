export const PALETTE_WIDTH_PX = 640;
export const PALETTE_RECENT_LIMIT = 5;
export const PALETTE_RESULT_LIMIT = 50;
export const PALETTE_SOURCE_BUILTIN = "builtin";
export const PALETTE_SOURCE_PROJECTS = "projects";
export const PALETTE_HIGHLIGHT_LAYOUT_ID = "command-palette-highlight";
export const PALETTE_PROJECTS_KEY = ["projects"] as const;
export const PALETTE_SNAPSHOT_PARAM = "palette";

export const FUZZY_SPREAD_FACTOR = 4;
export const FUZZY_MIN_SPREAD = 10;

export const MATCH_SCORE = {
  exact: 1000,
  prefix: 800,
  wordPrefix: 600,
  substring: 400,
  keyword: 300,
  subtitle: 200,
  fuzzy: 100,
} as const;
