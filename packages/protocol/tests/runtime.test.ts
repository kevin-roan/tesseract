import { describe, expect, test } from "bun:test";
import { restPaths, routePatterns, RUNTIME_KINDS, RuntimeEntrySchema, StopSignalQuerySchema } from "../src/index";

describe("runtime contract", () => {
  test("paths", () => {
    expect(restPaths.runtime()).toBe("/v1/runtime");
    expect(restPaths.runtimeEntry("app-run", "app_1")).toBe("/v1/runtime/app-run/app_1");
    expect(restPaths.runtimeEntry("vnc", "xvnc", { signal: "SIGKILL" })).toBe("/v1/runtime/vnc/xvnc?signal=SIGKILL");
    expect(restPaths.process("prc_1", { signal: "SIGKILL" })).toBe("/v1/processes/prc_1?signal=SIGKILL");
    expect(restPaths.appRun("app_1")).toBe("/v1/app-runs/app_1");
    expect(routePatterns.rest.runtimeEntry).toBe("/v1/runtime/:kind/:id");
  });

  test("entry schema", () => {
    expect(RUNTIME_KINDS).toEqual(["process", "app-run", "agent-run", "terminal", "browser", "vnc"]);
    const entry = {
      kind: "vnc" as const,
      id: "xvnc",
      name: "Xvnc display server",
      detail: null,
      pid: null,
      projectId: null,
      startedAt: null,
      state: "stopped",
      cpuPercent: null,
      memoryBytes: null,
      supervised: true,
      canStop: false,
    };
    expect(RuntimeEntrySchema.parse(entry)).toEqual(entry);
    expect(RuntimeEntrySchema.safeParse({ ...entry, kind: "daemon" }).success).toBe(false);
    expect(StopSignalQuerySchema.safeParse({ signal: "SIGINT" }).success).toBe(false);
  });
});
