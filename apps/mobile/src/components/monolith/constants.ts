import { Palette } from "@/theme";

export const MONOLITH = {
  /** The splash's light, fixed like the splash image itself. */
  light: Palette.clay[400],
  /** How far in from each edge the image fades out, as a fraction of the box. */
  feather: { x: 0.22, y: 0.18 },
  /** Seconds for the particles to drift through one loop. */
  drift: 40,
  particles: 36,
  /** Largest particle radius, in points. */
  particleSize: 1.1,
};
