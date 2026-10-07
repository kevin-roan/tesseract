import { resolve } from "node:path";
import { PICK_GRANT_TTL_MS } from "./constants";

interface Grant {
  owner: number;
  expiresAt: number;
}

export class PathGrants {
  private readonly grants = new Map<string, Grant[]>();

  constructor(
    private readonly ttlMs = PICK_GRANT_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  grant(owner: number, paths: Iterable<string>): void {
    this.prune();
    const expiresAt = this.now() + this.ttlMs;
    for (const path of paths) {
      const key = resolve(path);
      this.grants.set(key, [...(this.grants.get(key) ?? []), { owner, expiresAt }]);
    }
  }

  take(owner: number, path: string): boolean {
    this.prune();
    const key = resolve(path);
    const list = this.grants.get(key) ?? [];
    const index = list.findIndex((grant) => grant.owner === owner);
    if (index === -1) return false;
    list.splice(index, 1);
    if (list.length) this.grants.set(key, list);
    else this.grants.delete(key);
    return true;
  }

  forget(owner: number): void {
    for (const [key, list] of this.grants) {
      const kept = list.filter((grant) => grant.owner !== owner);
      if (kept.length) this.grants.set(key, kept);
      else this.grants.delete(key);
    }
  }

  private prune(): void {
    const now = this.now();
    for (const [key, list] of this.grants) {
      const kept = list.filter((grant) => grant.expiresAt > now);
      if (kept.length) this.grants.set(key, kept);
      else this.grants.delete(key);
    }
  }
}
