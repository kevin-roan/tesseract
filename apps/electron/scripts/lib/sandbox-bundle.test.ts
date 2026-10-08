import { describe, expect, it } from "vitest";
import { hasCrlf, manifestMismatches, needsLf } from "./sandbox-bundle.ts";

describe("sandbox bundle checks", () => {
  it("requires LF line endings for files the Linux image executes", () => {
    expect(needsLf("infra/docker/sandbox/rootfs/usr/local/bin/tesseract-start")).toBe(true);
    expect(needsLf("infra/docker/sandbox/Dockerfile")).toBe(true);
    expect(needsLf("apps/controller/scripts/run.sh")).toBe(true);
    expect(needsLf("apps/controller/src/index.ts")).toBe(false);
  });

  it("detects CRLF", () => {
    expect(hasCrlf(new TextEncoder().encode("a\nb\n"))).toBe(false);
    expect(hasCrlf(new TextEncoder().encode("a\r\nb"))).toBe(true);
  });

  it("reports files that drifted from the manifest", () => {
    const manifest = { files: { a: "1", b: "2", c: "3" } };
    const hashes: Record<string, string> = { a: "1", b: "x" };
    expect(manifestMismatches(manifest, (file) => hashes[file] ?? null)).toEqual(["b: sha256 differs", "c: missing"]);
  });
});
