const LOGO_URLS = import.meta.glob<string>("../../../theme/logos/*.svg", { eager: true, query: "?url", import: "default" });

export function logoUrl(slug: string | null): string | null {
  if (!slug) return null;
  return LOGO_URLS[`../../../theme/logos/${slug}.svg`] ?? null;
}
