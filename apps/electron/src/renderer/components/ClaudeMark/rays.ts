import { CLAUDE_MARK_GEOMETRY } from "./constants";

export interface Ray {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const round = (value: number) => Math.round(value * 100) / 100;

export function claudeRays({ box, rays, inner, outer } = CLAUDE_MARK_GEOMETRY): Ray[] {
  const center = box / 2;
  return Array.from({ length: rays }, (_, index) => {
    const angle = (index / rays) * Math.PI * 2 - Math.PI / 2;
    const reach = index % 2 === 0 ? outer : outer * 0.82;
    return {
      x1: round(center + Math.cos(angle) * inner),
      y1: round(center + Math.sin(angle) * inner),
      x2: round(center + Math.cos(angle) * reach),
      y2: round(center + Math.sin(angle) * reach),
    };
  });
}
