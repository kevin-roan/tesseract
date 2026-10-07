import type { DotSphereProps } from "./DotSphere";

export const DOT_SPHERE_SAMPLES: (DotSphereProps & { id: string })[] = [
  { id: "still", size: 20 },
  { id: "agent", size: 16, dots: 20, spinning: true, color: "text-on-accent" },
  { id: "large", size: 40, spinning: true },
  { id: "accent", size: 28, spinning: true, color: "accent-strong" },
];
