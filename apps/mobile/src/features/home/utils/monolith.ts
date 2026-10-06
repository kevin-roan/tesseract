import { Palette, type Theme } from "@/theme";

export type MonolithInk = {
  /** Lit face, top to bottom. */
  face: string[];
  /** Rounds the lit face off toward its outer edge. */
  faceShade: string[];
  shade: string;
  shadeSheen: string[];
  ridge: string[];
  edge: string[];
  /** Spark and the band of light it casts across the faces. */
  glow: string;
  /** Roof lines and dust, drawn partly against the screen. */
  ink: string;
};

const highlights = {
  faceShade: ["rgba(0, 0, 0, 0.22)", "rgba(0, 0, 0, 0)", "rgba(255, 255, 255, 0.08)"],
  shadeSheen: ["rgba(255, 255, 255, 0.09)", "rgba(255, 255, 255, 0)"],
  ridge: ["rgba(255, 255, 255, 0.55)", "rgba(255, 255, 255, 0)"],
  edge: ["rgba(255, 255, 255, 0.18)", "rgba(255, 255, 255, 0)"],
};

/** Monolith colors for a theme: a pale stone in dark mode, a grey one with a near-black shaded face in light mode. */
export function monolithInk({ mode, colors }: Theme): MonolithInk {
  if (mode === "light") {
    return {
      ...highlights,
      face: [Palette.graphite[300], Palette.graphite[400], Palette.graphite[500]],
      shade: "rgba(0, 0, 0, 0.78)",
      glow: Palette.white,
      ink: colors.text,
    };
  }
  return {
    ...highlights,
    face: [colors.text, colors.textSecondary, colors.textTertiary],
    shade: "rgba(0, 0, 0, 0.72)",
    glow: colors.text,
    ink: colors.text,
  };
}
