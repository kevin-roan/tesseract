import { describe, expect, it } from "vitest";
import { nextVersion, readVersion, setLockVersion, setPackageVersion } from "./release.ts";

describe("nextVersion", () => {
  it("bumps by release type", () => {
    expect(nextVersion("0.1.0", "patch")).toBe("0.1.1");
    expect(nextVersion("0.1.3", "minor")).toBe("0.2.0");
    expect(nextVersion("0.9.1", "major")).toBe("1.0.0");
  });

  it("accepts a higher exact version", () => {
    expect(nextVersion("0.1.0", "0.3.0")).toBe("0.3.0");
  });

  it("rejects a lower or equal version and junk", () => {
    expect(() => nextVersion("0.2.0", "0.2.0")).toThrow("not greater");
    expect(() => nextVersion("0.2.0", "0.1.9")).toThrow("not greater");
    expect(() => nextVersion("0.2.0", "huge")).toThrow("expected patch");
  });
});

describe("version files", () => {
  const packageJson = '{\n  "name": "@tesseract/electron",\n  "version": "0.1.0",\n  "dependencies": { "semver": "^7.8.5" }\n}\n';
  const lock = [
    '    "apps/controller": {',
    '      "name": "@tesseract/controller",',
    '      "version": "0.1.0",',
    "    },",
    '    "apps/electron": {',
    '      "name": "@tesseract/electron",',
    '      "version": "0.1.0",',
  ].join("\n");

  it("reads and writes only the package version", () => {
    expect(readVersion(packageJson)).toBe("0.1.0");
    const next = setPackageVersion(packageJson, "0.1.1");
    expect(readVersion(next)).toBe("0.1.1");
    expect(next).toContain('"semver": "^7.8.5"');
  });

  it("updates only the electron entry in bun.lock", () => {
    const next = setLockVersion(lock, "0.1.1");
    expect(next).toContain('"@tesseract/controller",\n      "version": "0.1.0"');
    expect(next).toContain('"@tesseract/electron",\n      "version": "0.1.1"');
  });

  it("fails when the lock entry is missing", () => {
    expect(() => setLockVersion("{}", "0.1.1")).toThrow("missing bun.lock");
  });
});
