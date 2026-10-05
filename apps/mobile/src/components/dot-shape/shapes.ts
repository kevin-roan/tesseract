export type DotPoint = { x: number; y: number };

/** Sides of each outline the dots trace in turn; 0 is a circle. */
export const SHAPE_SIDES = [3, 4, 0] as const;

/** Share of each shape's turn spent holding still before it morphs into the next. */
const HOLD = 0.55;
const GOLDEN = 0.618034;

/** Point `u` of the way round a unit outline, centred so each shape sits visually in the middle. */
function outlinePoint(sides: number, u: number): DotPoint {
  "worklet";
  if (sides === 0) {
    const angle = -Math.PI / 2 + u * Math.PI * 2;
    return { x: Math.cos(angle) * 0.82, y: Math.sin(angle) * 0.82 };
  }
  const start = sides === 4 ? -Math.PI * 0.75 : -Math.PI / 2;
  const scale = sides === 4 ? 0.95 : 1;
  const lift = sides === 3 ? 0.22 : 0;
  const edge = Math.floor(u * sides) % sides;
  const t = u * sides - Math.floor(u * sides);
  const a0 = start + (edge / sides) * Math.PI * 2;
  const a1 = start + ((edge + 1) / sides) * Math.PI * 2;
  return {
    x: (Math.cos(a0) + (Math.cos(a1) - Math.cos(a0)) * t) * scale,
    y: (Math.sin(a0) + (Math.sin(a1) - Math.sin(a0)) * t) * scale + lift,
  };
}

/**
 * Dot `index` of `count` at `phase` in [0, SHAPE_SIDES.length): holds each outline, then eases
 * into the next. `scatter` in [0, 1] pulls dots inward and lets them drift, turning a crisp
 * outline into a loose cloud. Coordinates are unit-sized around the origin.
 */
export function dotPoint(phase: number, index: number, count: number, scatter: number): DotPoint {
  "worklet";
  const shapes = SHAPE_SIDES.length;
  const step = Math.floor(phase) % shapes;
  const f = phase - Math.floor(phase);
  const m = f < HOLD ? 0 : (f - HOLD) / (1 - HOLD);
  const ease = m * m * (3 - 2 * m);
  const u = index / count;
  const from = outlinePoint(SHAPE_SIDES[step], u);
  const to = outlinePoint(SHAPE_SIDES[(step + 1) % shapes], u);
  const seed = (index * GOLDEN) % 1;
  const pull = 1 - scatter * seed * 0.45;
  const wave = phase * Math.PI * 2 + seed * Math.PI * 2;
  const drift = scatter * 0.07;
  return {
    x: (from.x + (to.x - from.x) * ease) * pull + Math.cos(wave) * drift,
    y: (from.y + (to.y - from.y) * ease) * pull + Math.sin(wave) * drift,
  };
}
