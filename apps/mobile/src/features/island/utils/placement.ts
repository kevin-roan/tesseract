import type { Corner, Edge, IslandPlacement, OrbDock, Point } from "../types";
import { EDGES, ISLAND_ORB_CORNER_SNAP, ISLAND_PLACEMENTS } from "./constants";

export type OrbBounds = { left: number; right: number; top: number; bottom: number };

export const isIslandPlacement = (value: unknown): value is IslandPlacement =>
  (ISLAND_PLACEMENTS as readonly unknown[]).includes(value);

export const isOrbDock = (value: unknown): value is OrbDock => {
  if (typeof value !== "object" || value === null) return false;
  const { edge, offset } = value as Partial<OrbDock>;
  return (EDGES as readonly unknown[]).includes(edge) && typeof offset === "number" && offset >= 0 && offset <= 1;
};

const clamp = (value: number, min: number, max: number): number => {
  "worklet";
  return Math.min(Math.max(value, min), max);
};

const fraction = (value: number, start: number, end: number): number => {
  "worklet";
  return end > start ? clamp((value - start) / (end - start), 0, 1) : 0;
};

export function cornerDock(corner: Corner): OrbDock {
  const offset = corner === "bottomLeft" || corner === "bottomRight" ? 1 : 0;
  return { edge: corner === "topLeft" || corner === "bottomLeft" ? "left" : "right", offset };
}

/** The corner a dock sits in, or `null` when it rests somewhere along an edge. */
export function dockCorner({ edge, offset }: OrbDock): Corner | null {
  if (offset !== 0 && offset !== 1) return null;
  const end = offset === 1;
  switch (edge) {
    case "left":
      return end ? "bottomLeft" : "topLeft";
    case "right":
      return end ? "bottomRight" : "topRight";
    case "top":
      return end ? "topRight" : "topLeft";
    case "bottom":
      return end ? "bottomRight" : "bottomLeft";
  }
}

export function dockPoint({ edge, offset }: OrbDock, bounds: OrbBounds): Point {
  "worklet";
  const alongX = bounds.left + offset * (bounds.right - bounds.left);
  const alongY = bounds.top + offset * (bounds.bottom - bounds.top);
  if (edge === "left") return { x: bounds.left, y: alongY };
  if (edge === "right") return { x: bounds.right, y: alongY };
  if (edge === "top") return { x: alongX, y: bounds.top };
  return { x: alongX, y: bounds.bottom };
}

/** The edge closest to where the orb was dropped, keeping its place along that edge and settling into a corner when near one. */
export function nearestDock(point: Point, bounds: OrbBounds): OrbDock {
  "worklet";
  const x = clamp(point.x, bounds.left, bounds.right);
  const y = clamp(point.y, bounds.top, bounds.bottom);
  const gaps: [Edge, number][] = [
    ["left", x - bounds.left],
    ["right", bounds.right - x],
    ["top", y - bounds.top],
    ["bottom", bounds.bottom - y],
  ];
  let [edge, gap] = gaps[0];
  for (const [candidate, distance] of gaps) {
    if (distance < gap) [edge, gap] = [candidate, distance];
  }
  const raw = edge === "left" || edge === "right" ? fraction(y, bounds.top, bounds.bottom) : fraction(x, bounds.left, bounds.right);
  const offset = raw < ISLAND_ORB_CORNER_SNAP ? 0 : raw > 1 - ISLAND_ORB_CORNER_SNAP ? 1 : raw;
  return { edge, offset };
}
