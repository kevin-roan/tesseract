import { describe, expect, it } from "vitest";
import { parseArgs } from "./args.ts";
import { builderArgs, DIST_VALUE_FLAGS, distPlan, requiredCliFiles } from "./dist-plan.ts";

function plan(argv: string[], env: Record<string, string | undefined> = {}, host: "linux" | "mac" | "win" = "linux") {
  return distPlan(parseArgs(argv, DIST_VALUE_FLAGS), env, host);
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
    });
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
});

describe("requiredCliFiles", () => {
  it("lists the binaries electron-builder copies into resources/bin", () => {
    expect(requiredCliFiles("win")).toEqual(["dist-cli/win-x64/tesseract.exe", "dist-cli/win-x64/tesseract-controller.exe"]);
    expect(requiredCliFiles("mac")).toHaveLength(4);
  });
});
