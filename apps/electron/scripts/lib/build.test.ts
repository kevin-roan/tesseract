import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildIsStale, withBuildLock } from "./build.ts";

const dirs: string[] = [];

function lockDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "tesseract-test-lock-"));
  dirs.push(dir);
  return join(dir, "build.lock");
}

afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe("build lock", () => {
  it("holds the lock while running and releases it afterwards", () => {
    const lock = lockDir();
    expect(withBuildLock(() => existsSync(lock), lock)).toBe(true);
    expect(existsSync(lock)).toBe(false);
  });

  it("times out on a fresh lock and breaks a stale one", () => {
    const lock = lockDir();
    mkdirSync(lock);
    expect(() => withBuildLock(() => 1, lock, 300)).toThrow(/build lock/);
    const old = new Date(Date.now() - 60 * 60_000);
    utimesSync(lock, old, old);
    expect(withBuildLock(() => 2, lock, 2_000)).toBe(2);
  });
});

describe("buildIsStale", () => {
  it("treats a build whose renderer is older than the sources as stale", () => {
    const dir = mkdtempSync(join(tmpdir(), "tesseract-test-stale-"));
    dirs.push(dir);
    const main = join(dir, "main.js");
    const renderer = join(dir, "index.html");
    const source = join(dir, "App.tsx");
    for (const file of [main, renderer, source]) writeFileSync(file, "");
    const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000);
    utimesSync(renderer, at(30), at(30));
    utimesSync(source, at(20), at(20));
    utimesSync(main, at(10), at(10));
    expect(buildIsStale([main, renderer], [source])).toBe(true);
    utimesSync(renderer, at(5), at(5));
    expect(buildIsStale([main, renderer], [source])).toBe(false);
    expect(buildIsStale([main, join(dir, "missing")], [source])).toBe(true);
  });
});
