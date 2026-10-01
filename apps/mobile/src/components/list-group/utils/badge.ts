export const BADGE_MAX = 99;

export function badgeLabel(badge: number | string | null | undefined, max = BADGE_MAX): string | null {
  if (typeof badge === "number") {
    if (!Number.isFinite(badge) || badge <= 0) return null;
    return badge > max ? `${max}+` : String(Math.floor(badge));
  }
  const text = badge?.trim();
  return text ? text : null;
}
