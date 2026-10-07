export type Point = { x: number; y: number };

type Vec4 = [number, number, number, number];
type Edge = [number, number];
type PathSink = { moveTo(x: number, y: number): unknown; lineTo(x: number, y: number): unknown };

const TAU = Math.PI * 2;

/** Seconds in one loop. Every motion turns a whole number of times per loop, so the wrap is seamless. */
export const TESSERACT_LOOP = 48;

/** Turns per loop: the XW and ZW planes turn the cube inside out, the yaw spins it in 3D. */
const TURNS = { xw: 3, zw: 1, yaw: 2 };

/** Fixed tilt so the tesseract is seen from slightly above, like the reference render. */
const PITCH = 0.42;

/** Camera distances in 4D and 3D; the 4D one sets how much smaller the far cube looks. */
const DISTANCE = { w: 4, z: 6 };

/** Half-extent of the projection in model units, so the figure fits its canvas at any pose. */
const EXTENT = 2.7;

/** Ghost poses trailing the live one, like the tesseract's light echoing through time. */
export const TESSERACT_ECHOES = [
  { lag: 0.35, opacity: 0.22 },
  { lag: 0.7, opacity: 0.12 },
  { lag: 1.05, opacity: 0.06 },
];

/** The 16 corners of the unit tesseract; bit 0 is x, 1 is y, 2 is z, 3 is w. */
export const TESSERACT_VERTICES: Vec4[] = Array.from({ length: 16 }, (_, index) => [
  index & 1 ? 1 : -1,
  index & 2 ? 1 : -1,
  index & 4 ? 1 : -1,
  index & 8 ? 1 : -1,
]);

/** The 32 edges, split into the two cubes (w = -1 and w = 1) and the struts joining them. */
export const TESSERACT_EDGES = (() => {
  const near: Edge[] = [];
  const far: Edge[] = [];
  const struts: Edge[] = [];
  for (let index = 0; index < 16; index += 1) {
    for (let bit = 0; bit < 4; bit += 1) {
      const other = index ^ (1 << bit);
      if (other < index) continue;
      if (bit === 3) struts.push([index, other]);
      else if (index & 8) far.push([index, other]);
      else near.push([index, other]);
    }
  }
  return { near, far, struts };
})();

/** Screen positions of the tesseract's corners at `t` seconds, centered in a square canvas of `size`. */
export function tesseractPoints(t: number, size: number): Point[] {
  "worklet";
  const turn = (t / TESSERACT_LOOP) * TAU;
  const cxw = Math.cos(turn * TURNS.xw);
  const sxw = Math.sin(turn * TURNS.xw);
  const czw = Math.cos(turn * TURNS.zw);
  const szw = Math.sin(turn * TURNS.zw);
  const cyaw = Math.cos(turn * TURNS.yaw);
  const syaw = Math.sin(turn * TURNS.yaw);
  const cpitch = Math.cos(PITCH);
  const spitch = Math.sin(PITCH);
  const center = size / 2;
  const scale = center / EXTENT;

  const points: Point[] = [];
  for (const [x, y, z, w] of TESSERACT_VERTICES) {
    const x1 = x * cxw - w * sxw;
    const w1 = x * sxw + w * cxw;
    const z1 = z * czw - w1 * szw;
    const w2 = z * szw + w1 * czw;

    const k4 = 2 / (DISTANCE.w - w2);
    const px = x1 * k4;
    const py = y * k4;
    const pz = z1 * k4;

    const x2 = px * cyaw + pz * syaw;
    const z2 = pz * cyaw - px * syaw;
    const y2 = py * cpitch - z2 * spitch;
    const z3 = py * spitch + z2 * cpitch;

    const k3 = DISTANCE.z / (DISTANCE.z - z3);
    points.push({ x: center + x2 * k3 * scale, y: center - y2 * k3 * scale });
  }
  return points;
}

/** Appends `edges` between `points` to a path as separate segments. */
export function traceEdges(path: PathSink, points: Point[], edges: Edge[]) {
  "worklet";
  for (const [from, to] of edges) {
    const a = points[from];
    const b = points[to];
    if (!a || !b) continue;
    path.moveTo(a.x, a.y);
    path.lineTo(b.x, b.y);
  }
}

export type Star = { angle: number; phase: number; speed: number };

function hash(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

/** A fixed field of stars rushing outward from the center; `speed` is whole passes per loop. */
export function starField(count: number): Star[] {
  return Array.from({ length: count }, (_, index) => ({
    angle: hash(index + 1) * TAU,
    phase: hash(index + 101),
    speed: 4 + Math.floor(hash(index + 211) * 5),
  }));
}

/** Appends one streak per star at `t` seconds; streaks lengthen as they near the edge, like a jump to warp. */
export function traceStars(path: PathSink, stars: Star[], t: number, size: number) {
  "worklet";
  const center = size / 2;
  const reach = center * 1.1;
  for (const star of stars) {
    const progress = (t / TESSERACT_LOOP) * star.speed + star.phase;
    const p = progress - Math.floor(progress);
    const outer = reach * (0.08 + p * p * 0.92);
    const inner = outer * (1 - 0.06 - p * 0.18);
    const dx = Math.cos(star.angle);
    const dy = Math.sin(star.angle);
    path.moveTo(center + dx * inner, center + dy * inner);
    path.lineTo(center + dx * outer, center + dy * outer);
  }
}
