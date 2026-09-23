const ORIGIN_PATTERN = /^(https?:\/\/[^/?#]+)/i;

export function originOf(url: string): string | null {
  const match = ORIGIN_PATTERN.exec(url.trim());
  return match ? match[1].toLowerCase() : null;
}

export function isAllowedUrl(url: string, allowedOrigin: string): boolean {
  return url === "about:blank" || originOf(url) === allowedOrigin.toLowerCase();
}
