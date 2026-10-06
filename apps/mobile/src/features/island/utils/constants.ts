export const RUN_TITLE_MAX = 60;
export const USAGE_DAYS = 7;
export const ACTIVITY_UPDATE_THROTTLE_MS = 1000;
export const ACTIVITY_END_GRACE_MS = 5000;
export const ELAPSED_TICK_MS = 1000;
export const CAPTURE_HIDE_DELAY_MS = 80;
export const MIN_CROP_SIZE = 48;
export const CROP_HANDLE_SIZE = 28;
export const INITIAL_CROP_INSET = 0.1;
export const CAPTURE_IMAGE_MIME_TYPE = "image/png";
export const RECENT_CHATS_LIMIT = 5;
export const ISLAND_ROUTE = "/island";
export const CORNERS = ["topLeft", "topRight", "bottomLeft", "bottomRight"] as const;
export const ISLAND_PLACEMENTS = [...CORNERS, "hidden"] as const;
export const DEFAULT_ISLAND_PLACEMENT = "bottomRight";
export const DEFAULT_ISLAND_DOCK = { edge: "right", offset: 1 } as const;
export const EDGES = ["left", "right", "top", "bottom"] as const;
/** Collapsed island: a capsule with a live glyph and one short value. */
export const ISLAND_CAPSULE_WIDTH = 120;
export const ISLAND_CAPSULE_HEIGHT = 40;
export const ISLAND_CAPSULE_GLYPH_SIZE = 18;
/** Expanded island: a fixed panel sized so everything fits without scrolling. */
export const ISLAND_PANEL_HEIGHT = 220;
export const ISLAND_PANEL_MAX_WIDTH = 420;
export const ISLAND_PANEL_RADIUS = 40;
export const ISLAND_PANEL_GLYPH_SIZE = 44;
/** Island color scheme for each app scheme, so the island stays near-black like the system one. */
export const ISLAND_SCHEMES = { light: "dark", dark: "dark", graphite: "graphite", graphiteLight: "graphite" } as const;
/** Spring the capsule morphs into the panel on, and the stiffer one it folds back with. */
export const ISLAND_OPEN_SPRING = { damping: 18, stiffness: 210, mass: 0.9 };
export const ISLAND_CLOSE_SPRING = { damping: 22, stiffness: 280, mass: 0.9 };
/** Morph progress over which the capsule content fades out, and later the panel content fades in. */
export const ISLAND_CAPSULE_FADE = [0, 0.3];
export const ISLAND_PANEL_FADE = [0.55, 1];
/** Panel content grows from this scale as it fades in. */
export const ISLAND_PANEL_ENTER_SCALE = 0.94;
export const ISLAND_DRAG_SPRING = { damping: 20, stiffness: 240, mass: 0.9 };
export const ISLAND_LIFT_SPRING = { damping: 14, stiffness: 320 };
/** Seconds of fling velocity added to where the island lands. */
export const ISLAND_ORB_FLING_PROJECTION = 0.12;
/** Offsets this close to an edge's end settle into the corner. */
export const ISLAND_ORB_CORNER_SNAP = 0.08;
/** How much the capsule grows while it is held and dragged. */
export const ISLAND_ORB_LIFT_SCALE = 1.06;
/** Finger travel before a press on the capsule turns into a drag. */
export const ISLAND_ORB_DRAG_SLOP = 6;
/** Room kept above the bottom safe area so the capsule clears the floating tab bar. */
export const ISLAND_ORB_BOTTOM_CLEARANCE = 88;
/** Smallest shrink for the panel's headline before it would truncate. */
export const HEADLINE_MIN_FONT_SCALE = 0.6;
/** How much a crop corner grows while it is being dragged. */
export const CROP_HANDLE_GRAB_SCALE = 1.25;
/** Where a card dropping out of the Dynamic Island starts: pulled up and pinched toward the island. */
export const ISLAND_DROP_FROM = { translateY: -12, scaleX: 0.35, scaleY: 0.2 };
