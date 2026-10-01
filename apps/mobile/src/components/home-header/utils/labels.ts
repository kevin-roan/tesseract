/** Badge text for an unread count: nothing at zero, "99+" past two digits. */
export function inboxBadgeLabel(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count > 99 ? "99+" : String(Math.floor(count));
}

/** Screen-reader label that carries the count the badge shows visually. */
export function inboxButtonLabel(count: number): string {
  const badge = inboxBadgeLabel(count);
  if (!badge) return "Open inbox";
  return `Open inbox, ${badge} unread`;
}
