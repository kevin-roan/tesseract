import { describe, expect, it } from "vitest";
import { encodeSnapshotArg } from "../../shared/runtime";
import { localCommandArgs, parseLaunchArgs } from "./args";

describe("parseLaunchArgs", () => {
  it("reads the GTK-compatible flags", () => {
    const args = parseLaunchArgs(["electron", ".", "--hidden", "--debug", "--page", "agents"]);
    expect(args).toMatchObject({ hidden: true, debug: true, quit: false, page: "agents", deepLink: null, localCommand: null });
  });

  it("accepts --page=<id> and ignores unknown pages", () => {
    expect(parseLaunchArgs(["x", "--page=files"]).page).toBe("files");
    expect(parseLaunchArgs(["x", "--page", "nope"]).page).toBeNull();
  });

  it("finds a deep link anywhere in argv", () => {
    expect(parseLaunchArgs(["Monolith.exe", "--allow-file-access", "monolith://agents?new=1"]).deepLink).toBe("monolith://agents?new=1");
  });

  it("decodes the snapshot request", () => {
    const request = { route: "/overview", out: "/tmp/a.png", width: 1024, height: 768, appearance: "dark" as const, timeoutMs: 0 };
    expect(parseLaunchArgs(["x", encodeSnapshotArg(request)]).snapshot).toEqual(request);
  });
});

describe("localCommandArgs", () => {
  it("returns null when no local command is present", () => {
    expect(localCommandArgs(["electron", ".", "--hidden", "--force"])).toBeNull();
  });

  it("keeps the command and its modifiers, dropping Chromium switches", () => {
    expect(localCommandArgs(["Monolith", "--no-sandbox", "--sync", "--confidential"])).toEqual(["--sync", "--confidential"]);
    expect(localCommandArgs(["Monolith", "--pull", "--dry-run", "--force"])).toEqual(["--pull", "--dry-run", "--force"]);
    expect(localCommandArgs(["Monolith", "--sync-status"])).toEqual(["--sync-status"]);
  });
});

describe("second-instance argv", () => {
  it("finds the --page value after Chromium moves switches before positional args", () => {
    const argv = ["electron", "--ozone-platform=headless", "--page", "--allow-file-access-from-files", "/repo/apps/electron", "agents"];
    expect(parseLaunchArgs(argv).page).toBe("agents");
  });
});
