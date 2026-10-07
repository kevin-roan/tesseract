import { describe, expect, it } from "vitest";
import { isDockerReady } from "./checks";
import { probeDocker } from "./probe";
import { whichExecutable } from "./system";

const hasDocker = whichExecutable("docker", process.env, process.platform) !== null;

describe.skipIf(!hasDocker)("probeDocker against this computer (read-only)", () => {
  it("returns a consistent report", async () => {
    const lines: string[] = [];
    const report = await probeDocker({ onLog: (line) => lines.push(line) });
    expect(report.cli?.path).toBeTruthy();
    expect(report.checks[0]?.id).toBe("cli");
    expect(lines[0]).toMatch(/^\$ .*docker --version$/);
    if (report.daemon === "reachable") {
      expect(report.server?.ncpu).toBeGreaterThan(0);
      expect(report.checks.find((check) => check.id === "daemon")?.status).toBe("ok");
    } else {
      expect(isDockerReady(report, process.platform)).toBe(false);
    }
  });
});
