export function formatCount(count: number | null | undefined, max: number): string | null {
  if (!count || count <= 0) return null;
  return count > max ? `${max}+` : String(count);
}
