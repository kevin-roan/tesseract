import { Skia } from "@shopify/react-native-skia";

import type { ObeliskGeometry, Point } from "@/components/splash-overlay/geometry";

type PathSink = { addCircle(x: number, y: number, r: number): unknown };

const TAU = Math.PI * 2;

export type Particle = {
  x: number;
  y: number;
  rise: number;
  r: number;
  sway: number;
};

function hash(seed: number) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/** A seeded field of `count` specks, each at most `maxRadius` across. */
export function particleField(count: number, maxRadius: number): Particle[] {
  return Array.from({ length: count }, (_, index) => ({
    x: hash(index + 1),
    y: hash(index + 41),
    rise: 1 + Math.floor(hash(index + 83) * 2),
    r: maxRadius * (0.35 + hash(index + 127) * 0.65),
    sway: hash(index + 173) * TAU,
  }));
}

/** Appends every speck at `progress` (0–1 through a loop), drifting up through a `width` × `height` box. */
export function traceParticles(path: PathSink, particles: Particle[], progress: number, width: number, height: number) {
  "worklet";
  for (const particle of particles) {
    const climb = particle.y - progress * particle.rise;
    const y = (climb - Math.floor(climb)) * height;
    const x = particle.x * width + Math.sin(progress * TAU * particle.rise + particle.sway) * 4;
    path.addCircle(x, y, particle.r);
  }
}

/** The obelisk's silhouette as separate strokes: the roof, the two outer edges and the ridge. */
export function obeliskEdges({ tip, leftShoulder, rightShoulder, ridgeBottom }: ObeliskGeometry) {
  const line = (from: Point, to: Point) => {
    const path = Skia.Path.Make();
    path.moveTo(from.x, from.y);
    path.lineTo(to.x, to.y);
    return path;
  };
  return {
    roof: [line(tip, leftShoulder), line(tip, rightShoulder)],
    sides: [
      line(leftShoulder, { x: leftShoulder.x, y: ridgeBottom }),
      line(rightShoulder, { x: rightShoulder.x, y: ridgeBottom }),
    ],
    ridge: line(tip, { x: tip.x, y: ridgeBottom }),
  };
}
