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
/** Diameter of the in-app island orb. */
export const ISLAND_ORB_SIZE = 52;
/** Width of the orb's chrome bezel. */
export const ISLAND_ORB_BEZEL_WIDTH = 4;
/** Width of the live ring that sweeps inside the bezel. */
export const ISLAND_ORB_RING_WIDTH = 2;
/** Room around the orb's canvas for its drop shadow and glow. */
export const ISLAND_ORB_CANVAS_PAD = 14;
/** Chrome bezel stops, swept clockwise from 3 o'clock, with prismatic glints at the two highlights. */
export const ISLAND_ORB_CHROME = {
  colors: [
    "#8a8f99", "#eef1f6", "#7aa7ff", "#ffb26b", "#d6dbe4", "#5b5f68", "#24262b", "#9ca2ad",
    "#f7f9fc", "#ffb26b", "#7aa7ff", "#e4e8ef", "#6c717b", "#2a2c31", "#b9bec8", "#8a8f99",
  ],
  positions: [0, 0.08, 0.105, 0.125, 0.16, 0.26, 0.36, 0.46, 0.56, 0.585, 0.605, 0.64, 0.75, 0.85, 0.95, 1],
};
/** Smoked-glass face, lit from above. */
export const ISLAND_ORB_FACE = ["#2c2d31", "#141416", "#09090a"];
export const ISLAND_ORB_SHEEN = ["rgba(255,255,255,0.16)", "rgba(255,255,255,0)"];
export const ISLAND_ORB_RIM_LIGHT = ["rgba(255,255,255,0.55)", "rgba(255,255,255,0)"];
export const ISLAND_ORB_TRACK = "rgba(255,255,255,0.06)";
export const ISLAND_ORB_SPECULAR = "#ffffff";
export const ISLAND_ORB_INNER_SHADOW = "rgba(0,0,0,0.85)";
export const ISLAND_ORB_DROP_SHADOW = "rgba(0,0,0,0.7)";
/** One breath of the live dot's glow. */
export const ISLAND_ORB_PULSE_MS = 1400;
/** How far a drag spins the bezel's reflections, in radians per point. */
export const ISLAND_ORB_SHEEN_PER_POINT = 0.012;
/** Seconds of fling velocity added to where the orb lands. */
export const ISLAND_ORB_FLING_PROJECTION = 0.12;
/** Offsets this close to an edge's end settle into the corner. */
export const ISLAND_ORB_CORNER_SNAP = 0.08;
/** How much the orb grows while it is held and dragged. */
export const ISLAND_ORB_LIFT_SCALE = 1.08;
/** One turn of the orb's live ring. */
export const ISLAND_ORB_SPIN_MS = 1600;
/** Finger travel before a press on the orb turns into a drag. */
export const ISLAND_ORB_DRAG_SLOP = 6;
/** Room kept above the bottom safe area so the orb clears the floating tab bar. */
export const ISLAND_ORB_BOTTOM_CLEARANCE = 88;
/** Smallest shrink for a stat figure such as "12.3M" before it would truncate. */
export const STAT_MIN_FONT_SCALE = 0.6;
/** Scale the island card grows from as it opens out of the capsule. */
export const ISLAND_OPEN_SCALE = 0.94;
/** How much a crop corner grows while it is being dragged. */
export const CROP_HANDLE_GRAB_SCALE = 1.25;
