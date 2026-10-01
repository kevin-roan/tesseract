export type SpherePoint = { x: number; y: number; z: number };

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Dots are grouped by how far they face the viewer; each group is one path with one opacity. */
export const DEPTH_BANDS = 5;

/** Distinct poses per full turn; the paths are rebuilt only when the pose changes, not every frame. */
export const FRAMES_PER_TURN = 90;

export function spherePoints(count: number): SpherePoint[] {
  return Array.from({ length: count }, (_, index) => {
    const y = 1 - ((index + 0.5) / count) * 2;
    const ring = Math.sqrt(1 - y * y);
    const angle = index * GOLDEN_ANGLE;
    return { x: Math.cos(angle) * ring, y, z: Math.sin(angle) * ring };
  });
}

export function bandOpacity(band: number): number {
  return 0.12 + ((band + 0.5) / DEPTH_BANDS) * 0.88;
}

/** One SVG path per depth band for the sphere turned by `angle`; dots nearer the viewer are larger. */
export function spherePaths(points: SpherePoint[], angle: number, center: number, radius: number, dotRadius: number): string[] {
  "worklet";
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const paths: string[] = [];
  for (let band = 0; band < DEPTH_BANDS; band += 1) paths.push("");
  for (const point of points) {
    const depth = (point.z * cos - point.x * sin + 1) / 2;
    const band = Math.min(DEPTH_BANDS - 1, Math.floor(depth * DEPTH_BANDS));
    const r = dotRadius * (0.45 + depth * 0.55);
    const cx = center + (point.x * cos + point.z * sin) * radius;
    const cy = center - point.y * radius;
    paths[band] += `M${(cx - r).toFixed(2)} ${cy.toFixed(2)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(2 * r).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-2 * r).toFixed(2)} 0`;
  }
  return paths;
}
