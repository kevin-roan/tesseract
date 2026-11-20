import type { RateLimit } from "./config";

export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: RateLimit,
    private readonly now: () => number = Date.now,
  ) {}

  /** Counts one attempt for `key`; returns the seconds to wait when over the limit, else 0. */
  hit(key: string): number {
    const now = this.now();
    if (this.hits.size > 10_000) this.prune(now);
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.limit.windowMs });
      return 0;
    }
    entry.count += 1;
    return entry.count > this.limit.max ? Math.ceil((entry.resetAt - now) / 1000) : 0;
  }

  private prune(now: number): void {
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}
