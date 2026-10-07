import { describe, expect, it } from "vitest";
import { NSIS_PATH_CASES, nsisPathMismatches, nsisPathScript } from "./nsis-path.ts";

describe("NSIS PATH harness", () => {
  it("includes installer.nsh and calls the PATH function for every case", () => {
    const script = nsisPathScript("/repo/build/installer.nsh", "/tmp/x/result.txt");
    expect(script).toContain('!include "/repo/build/installer.nsh"');
    expect(script).toContain('FileOpen $Out "Z:\\tmp\\x\\result.txt" w');
    expect(script.match(/Call MonolithUpdateUserPath/g)).toHaveLength(NSIS_PATH_CASES.length);
  });

  it("compares the dumped registry values", () => {
    const good = NSIS_PATH_CASES.map((step) => `${step.name}=${step.expected ?? "<missing>"}`).join("\r\n");
    expect(nsisPathMismatches(good)).toEqual([]);
    expect(nsisPathMismatches(good.replace("remove-only=<missing>", "remove-only=C:\\x"))).toEqual([
      "remove-only: expected <missing>, got C:\\x",
    ]);
  });
});
