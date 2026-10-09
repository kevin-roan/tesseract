/** Largest share of the panel width the monolith takes, its widest size, and how tall it is against its width. */
const HERO = { share: 0.62, maxWidth: 260, aspect: 1.4 };

export type Size = { width: number; height: number };

/** The monolith's box inside a `panel`: narrower than the screen and no taller than the room it has. */
export function heroBox(panel: Size): Size {
  const width = Math.min(panel.width * HERO.share, HERO.maxWidth);
  return { width, height: Math.min(panel.height, width * HERO.aspect) };
}
