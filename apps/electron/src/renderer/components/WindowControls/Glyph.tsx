import { GLYPH } from "./constants";
import { GLYPH_PATHS, type GlyphName } from "./geometry";

export function Glyph({ name }: { name: GlyphName }) {
  return (
    <svg width={GLYPH.canvas} height={GLYPH.canvas} viewBox={`0 0 ${GLYPH.canvas} ${GLYPH.canvas}`} aria-hidden focusable={false}>
      <path d={GLYPH_PATHS[name]} fill="none" stroke="currentColor" strokeWidth={GLYPH.stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
