import { describe, expect, it } from "vitest";
import { parseArgs } from "./args.ts";
import { builderArgs, DIST_VALUE_FLAGS, distPlan, missingCliMessage, requiredCliFiles } from "./dist-plan.ts";

function plan(argv: string[], env: Record<string, string | undefined> = {}, host: "linux" | "mac" | "win" = "linux", keychainIdentity = false) {
  return distPlan(parseArgs(argv, DIST_VALUE_FLAGS), env, host, keychainIdentity);
}

describe("distPlan", () => {
  it("defaults to the host platform without publishing", () => {
    expect(plan([], {}, "mac")).toEqual({
      platform: "mac",
      dir: false,
      publish: "never",
      updateUrl: null,
      channel: null,
      build: true,
      cli: true,
      sandbox: true,
      smoke: false,
      adHocSign: true,
    });
  });

  it("ad-hoc signs mac builds only when no signing certificate is configured", () => {
    expect(plan([], {}, "mac").adHocSign).toBe(true);
    expect(plan([], { CSC_LINK: "/certs/developer-id.p12" }, "mac").adHocSign).toBe(false);
    expect(plan([], { CSC_NAME: "Tesseract (TEAMID)" }, "mac").adHocSign).toBe(false);
    expect(plan([], {}, "mac", true).adHocSign).toBe(false);
    expect(plan(["--platform", "win"], {}, "mac").adHocSign).toBe(false);
  });

  it("reads the update feed from flags before the environment", () => {
    const env = { TESSERACT_UPDATE_URL: "https://env.example/desktop", TESSERACT_UPDATE_CHANNEL: "beta" };
    expect(plan([], env)).toMatchObject({ updateUrl: "https://env.example/desktop", channel: "beta" });
    expect(plan(["--update-url", "https://flag.example/feed/"], env)).toMatchObject({ updateUrl: "https://flag.example/feed" });
  });

  it("rejects bad values", () => {
    expect(() => plan(["--platform", "beos"])).toThrow(/--platform/);
    expect(() => plan(["--publish", "sometimes"])).toThrow(/--publish/);
    expect(() => plan(["--update-url", "ftp://x"])).toThrow(/http/);
    expect(() => plan(["--channel", "Beta!"])).toThrow(/channel/);
  });

  it("only smoke-tests the Linux AppImage on Linux", () => {
    expect(plan(["--smoke"]).smoke).toBe(true);
    expect(() => plan(["--smoke", "--platform", "win"])).toThrow(/Linux/);
    expect(() => plan(["--smoke", "--dir"])).toThrow(/AppImage/);
    expect(() => plan(["--smoke", "--platform", "linux"], {}, "mac")).toThrow(/Linux host/);
  });
});

describe("builderArgs", () => {
  it("builds electron-builder arguments with feed overrides", () => {
    const args = builderArgs(plan(["--platform", "win", "--dir", "--update-url", "https://u.example", "--channel", "beta"]));
    expect(args).toEqual([
      "--config",
      "electron-builder.yml",
      "--win",
      "--publish",
      "never",
      "--dir",
      "-c.publish.url=https://u.example",
      "-c.publish.channel=beta",
    ]);
  });

  it("passes the ad-hoc identity to unsigned mac builds", () => {
    expect(builderArgs(plan(["--platform", "mac"]))).toContain("-c.mac.identity=-");
    expect(builderArgs(plan(["--platform", "mac"], { CSC_LINK: "/certs/developer-id.p12" }))).not.toContain("-c.mac.identity=-");
  });
});

describe("requiredCliFiles", () => {
  it("lists the binaries electron-builder copies into resources/bin", () => {
    expect(requiredCliFiles("win")).toEqual(["dist-cli/win-x64/tesseract.exe", "dist-cli/win-x64/tesseract-controller.exe"]);
    expect(requiredCliFiles("mac")).toHaveLength(6);
    expect(requiredCliFiles("mac")).toContain("dist-cli/mac-arm64/tesseract-simcap");
    expect(requiredCliFiles("mac")).toContain("dist-cli/mac-x64/tesseract-simcap");
    expect(requiredCliFiles("linux")).toEqual(["dist-cli/linux-x64/tesseract", "dist-cli/linux-x64/tesseract-controller"]);
  });
});

describe("missingCliMessage", () => {
  it("points at cli:build for missing Bun binaries", () => {
    expect(missingCliMessage(["dist-cli/linux-x64/tesseract"], "linux")).toBe("missing CLI binaries: dist-cli/linux-x64/tesseract (run cli:build)");
  });

  it("says a mac dist needs a Mac when tesseract-simcap is missing on another host", () => {
    const message = missingCliMessage(["dist-cli/mac-x64/tesseract-simcap"], "linux");
    expect(message).toContain("must be built on a Mac");
    expect(message).not.toContain("run cli:build");
  });

  it("points at the swiftc failure when tesseract-simcap is missing on a Mac", () => {
    const message = missingCliMessage(["dist-cli/mac-arm64/tesseract", "dist-cli/mac-arm64/tesseract-simcap"], "darwin");
    expect(message).toContain("swiftc failed");
    expect(message).toContain("Command Line Tools");
  });
});
