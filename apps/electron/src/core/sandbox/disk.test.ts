import { describe, expect, it } from "vitest";
import { checkDiskSpace, diskRequirementGb } from "./disk";
import { readyReport } from "./test-support";

describe("disk space", () => {
  it("applies the spec formula rounded up to 5 GB", () => {
    expect(diskRequirementGb([])).toBe(25);
    expect(diskRequirementGb(["android", "flutter", "mono", "whisper"])).toBe(35);
  });

  it("measures the nearest existing ancestor of DockerRootDir on Linux engines", async () => {
    const seen: string[] = [];
    const freeBytes = async (path: string) => {
      seen.push(path);
      if (path !== "/var/lib") throw new Error("ENOENT");
      return 12e9;
    };
    const result = await checkDiskSpace({ platform: "linux", freeBytes }, readyReport(), ["android"]);
    expect(seen).toEqual(["/var/lib/docker", "/var/lib"]);
    expect(result).toEqual({ kind: "low", path: "/var/lib", freeGb: 12, needGb: 30 });
    expect((await checkDiskSpace({ platform: "linux", freeBytes: async () => 100e9 }, readyReport(), [])).kind).toBe("ok");
  });

  it("only warns for VM engines", async () => {
    const freeBytes = async () => 0;
    expect(await checkDiskSpace({ platform: "darwin", freeBytes }, readyReport({ kind: "desktop" }), [])).toEqual({ kind: "vm", needGb: 25 });
    expect((await checkDiskSpace({ platform: "linux", freeBytes }, readyReport({ kind: "desktop" }), [])).kind).toBe("vm");
  });
});
