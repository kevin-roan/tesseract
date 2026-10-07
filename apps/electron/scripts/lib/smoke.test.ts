import { describe, expect, it } from "vitest";
import { artifactName, parseCliVersion, parseUpdateFeed, pngSize } from "./smoke.ts";

describe("smoke helpers", () => {
  it("names the Linux artifacts like electron-builder", () => {
    expect(artifactName("0.1.0", "AppImage")).toBe("Monolith-0.1.0-x86_64.AppImage");
    expect(artifactName("0.1.0", "deb")).toBe("Monolith-0.1.0-amd64.deb");
  });

  it("parses the CLI version line", () => {
    expect(parseCliVersion("monolith 0.1.0\n")).toBe("0.1.0");
    expect(parseCliVersion("error")).toBeNull();
  });

  it("reads PNG dimensions from the IHDR chunk", () => {
    const header = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 3, 112, 0, 0, 2, 108]);
    expect(pngSize(header)).toEqual({ width: 880, height: 620 });
    expect(pngSize(new Uint8Array(24))).toBeNull();
  });

  it("parses app-update.yml", () => {
    expect(parseUpdateFeed("provider: generic\nurl: https://downloads.monolith.dev/desktop\nupdaterCacheDirName: monolith-updater\n")).toEqual({
      provider: "generic",
      url: "https://downloads.monolith.dev/desktop",
      channel: null,
    });
  });
});
