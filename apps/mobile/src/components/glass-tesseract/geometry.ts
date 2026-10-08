import { TESSERACT_VERTICES, type Point } from "@/components/tesseract/geometry";

type PathSink = {
  moveTo(x: number, y: number): unknown;
  lineTo(x: number, y: number): unknown;
  close(): unknown;
  addCircle(x: number, y: number, r: number): unknown;
};

const TAU = Math.PI * 2;

export const GLASS_TESSERACT = {
  /** Seconds in one loop; every motion turns a whole number of times per loop. */
  loop: 32,
  /** Idle yaw turns per loop. */
  spin: 1,
  /** How far the inner cube folds through the fourth axis, in radians, and how often per loop. */
  fold: { depth: 0.42, turns: 2 },
  /** Extra fold while the core flares after a tap. */
  flareFold: 0.5,
  /** Resting tilt, seen from slightly above, and how far a drag may tilt it either way. */
  pitch: { rest: 0.42, max: 1.1 },
  /** Radians of turn per point dragged. */
  dragRate: 0.008,
  distance: { w: 3.2, z: 7 },
  /** Half-extent of the projection in model units, so the figure fits its canvas in every pose. */
  extent: 2.1,
  /** Where the floor sits, as a fraction of the cube's square, and how tall the canvas is with the reflection. */
  floor: 0.93,
  canvas: 1.3,
  /** Light from the upper left, toward the viewer. */
  light: [-0.42, 0.62, 0.66] as const,
  /** Core hues the glass cycles through, one stop at a time. */
  colors: ["#FF8A3D", "#FF4F7B", "#B45CFF", "#4C7DFF", "#2ED3E6", "#5BE38A", "#FFC93D"],
  /** Seconds for one pass through every hue. */
  colorPeriod: 21,
};

export type GlassPose = { t: number; yaw: number; pitch: number; flare: number };

export type FaceShade = { front: boolean; light: number };

export type GlassFrame = { points: Point[]; faces: FaceShade[] };

/** The 12 quads of the inner (w = -1) and outer (w = 1) cubes, outer first, each wound around its face. */
export const GLASS_FACES = (() => {
  const quads: number[][] = [];
  for (const cube of [8, 0]) {
    for (let axis = 0; axis < 3; axis += 1) {
      const [u, v] = [0, 1, 2].filter((bit) => bit !== axis) as [number, number];
      for (const side of [0, 1]) {
        const base = cube | (side << axis);
        quads.push([base, base | (1 << u), base | (1 << u) | (1 << v), base | (1 << v)]);
      }
    }
  }
  return quads;
})();

export const OUTER_FACES = [0, 1, 2, 3, 4, 5];
export const INNER_FACES = [6, 7, 8, 9, 10, 11];

/** Corners on screen and how each face is lit, for a pose, in a square of `size`. */
export function glassFrame(pose: GlassPose, size: number): GlassFrame {
  "worklet";
  const { loop, spin, fold, flareFold, distance, extent, light } = GLASS_TESSERACT;
  const turn = (pose.t / loop) * TAU;
  const folding = Math.sin(turn * fold.turns) * fold.depth + pose.flare * flareFold;
  const xw = folding;
  const zw = Math.cos(turn * fold.turns) * fold.depth * 0.6;
  const yaw = pose.yaw + turn * spin;
  const cxw = Math.cos(xw);
  const sxw = Math.sin(xw);
  const czw = Math.cos(zw);
  const szw = Math.sin(zw);
  const cyaw = Math.cos(yaw);
  const syaw = Math.sin(yaw);
  const cpitch = Math.cos(pose.pitch);
  const spitch = Math.sin(pose.pitch);
  const center = size / 2;
  const scale = center / extent;

  const space: [number, number, number][] = [];
  const points: Point[] = [];
  for (const [x, y, z, w] of TESSERACT_VERTICES) {
    const x1 = x * cxw - w * sxw;
    const w1 = x * sxw + w * cxw;
    const z1 = z * czw - w1 * szw;
    const w2 = z * szw + w1 * czw;

    const k4 = (distance.w - 1) / (distance.w - w2);
    const px = x1 * k4;
    const py = y * k4;
    const pz = z1 * k4;

    const x2 = px * cyaw + pz * syaw;
    const z2 = pz * cyaw - px * syaw;
    const y2 = py * cpitch - z2 * spitch;
    const z3 = py * spitch + z2 * cpitch;

    space.push([x2, y2, z3]);
    const k3 = distance.z / (distance.z - z3);
    points.push({ x: center + x2 * k3 * scale, y: center - y2 * k3 * scale });
  }

  const faces: FaceShade[] = [];
  for (let index = 0; index < GLASS_FACES.length; index += 1) {
    const quad = GLASS_FACES[index]!;
    const cube = index < 6 ? 8 : 0;
    let fx = 0;
    let fy = 0;
    let fz = 0;
    for (const corner of quad) {
      fx += space[corner]![0] / 4;
      fy += space[corner]![1] / 4;
      fz += space[corner]![2] / 4;
    }
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let corner = cube; corner < cube + 8; corner += 1) {
      cx += space[corner]![0] / 8;
      cy += space[corner]![1] / 8;
      cz += space[corner]![2] / 8;
    }
    const nx = fx - cx;
    const ny = fy - cy;
    const nz = fz - cz;
    const length = Math.hypot(nx, ny, nz) || 1;
    const front = nx * -fx + ny * -fy + nz * (distance.z - fz) > 0;
    const lit = (nx * light[0] + ny * light[1] + nz * light[2]) / length;
    faces.push({ front, light: Math.max(0, lit) });
  }

  return { points, faces };
}

/** Appends the quads in `faces` to a path, keeping only those facing the viewer (or away, when `front` is false). */
export function traceFaces(path: PathSink, frame: GlassFrame, faces: number[], front?: boolean) {
  "worklet";
  for (const index of faces) {
    const shade = frame.faces[index];
    if (!shade || (front !== undefined && shade.front !== front)) continue;
    const quad = GLASS_FACES[index]!;
    const first = frame.points[quad[0]!]!;
    path.moveTo(first.x, first.y);
    for (let corner = 1; corner < 4; corner += 1) {
      const point = frame.points[quad[corner]!]!;
      path.lineTo(point.x, point.y);
    }
    path.close();
  }
}

/** Where the inner cube's center lands on screen. */
export function coreCenter(frame: GlassFrame): Point {
  "worklet";
  let x = 0;
  let y = 0;
  for (let corner = 0; corner < 8; corner += 1) {
    x += frame.points[corner]!.x / 8;
    y += frame.points[corner]!.y / 8;
  }
  return { x, y };
}

export type Mote = { x: number; y: number; rise: number; r: number; sway: number };

function hash(seed: number) {
  const value = Math.sin(seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/** A fixed field of dust motes; `rise` is whole climbs per loop. */
export function moteField(count: number): Mote[] {
  return Array.from({ length: count }, (_, index) => ({
    x: hash(index + 1),
    y: hash(index + 41),
    rise: 1 + Math.floor(hash(index + 83) * 3),
    r: 0.6 + hash(index + 127) * 1.6,
    sway: hash(index + 173) * TAU,
  }));
}

/** Appends every mote at `t` seconds, drifting up through a `width` × `height` box. */
export function traceMotes(path: PathSink, motes: Mote[], t: number, width: number, height: number) {
  "worklet";
  const progress = t / GLASS_TESSERACT.loop;
  for (const mote of motes) {
    const climb = mote.y - progress * mote.rise;
    const y = (climb - Math.floor(climb)) * height;
    const x = mote.x * width + Math.sin(progress * TAU * mote.rise + mote.sway) * 6;
    path.addCircle(x, y, mote.r);
  }
}
