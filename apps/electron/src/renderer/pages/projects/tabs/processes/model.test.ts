import type { ListeningPort, ProcessInfo } from "@tesseract/protocol";
import { sampleProcess, sampleProject } from "@tesseract/protocol/fixtures";
import { describe, expect, it } from "vitest";
import { portUrl, processMeta, processStatus, projectPorts, scriptCommand, scriptRequest, shellWord } from "./model";

const NOW = Date.parse("2026-09-23T12:00:00Z");
const process = (patch: Partial<ProcessInfo>): ProcessInfo => ({ ...sampleProcess, ...patch });
const port = (patch: Partial<ListeningPort>): ListeningPort => ({
  port: 3000,
  pid: 1,
  command: "node",
  processId: null,
  projectId: "p",
  url: null,
  dnsUrl: null,
  ...patch,
});

describe("processes model", () => {
  it("maps states to glyph statuses", () => {
    expect(processStatus(process({ state: "running" }))).toEqual({ label: "Running", tone: "success", glyph: true });
    expect(processStatus(process({ state: "exited", exitCode: 1 }))).toMatchObject({ label: "Failed", tone: "danger" });
    expect(processStatus(process({ state: "exited", exitCode: 0 }))).toMatchObject({ label: "Exited", tone: "neutral" });
    expect(processStatus(process({ state: "exited", exitCode: null }))).toMatchObject({ label: "Exited", tone: "neutral" });
    expect(processStatus(process({ state: "starting" }))).toMatchObject({ label: "Starting", tone: "info" });
    expect(processStatus(process({ state: "orphaned" }))).toMatchObject({ label: "Orphaned", tone: "warning" });
  });

  it("builds live and ended meta", () => {
    const live = process({ state: "running", startedAt: "2026-09-23T11:47:00Z", port: 8081, pid: 86081, display: false });
    expect(processMeta(live, NOW)).toBe("started 13m ago · :8081 · pid 86081");
    const ended = process({
      state: "exited",
      exitCode: 1,
      startedAt: "2026-09-23T07:00:00Z",
      endedAt: "2026-09-23T07:00:01Z",
      port: 8081,
      display: false,
    });
    expect(processMeta(ended, NOW)).toBe("ran 1s · ended 4h ago · :8081 · exit 1");
    const shown = process({ state: "stopped", exitCode: null, display: true, port: null, startedAt: "2026-09-23T11:00:00Z", endedAt: "2026-09-23T11:14:58Z" });
    expect(processMeta(shown, NOW)).toBe("ran 14m 58s · ended 45m ago · display");
  });

  it("filters and sorts ports and resolves URLs", () => {
    expect(projectPorts([port({ port: 9 }), port({ port: 2 }), port({ projectId: "x" })], "p").map((item) => item.port)).toEqual([2, 9]);
    expect(portUrl(port({ url: "http://a:1", dnsUrl: "http://b:1" }), "h")).toBe("http://a:1");
    expect(portUrl(port({ dnsUrl: "http://b:1" }), "h")).toBe("http://b:1");
    expect(portUrl(port({}), "127.0.0.1")).toBe("http://127.0.0.1:3000");
    expect(portUrl(port({}), "::1")).toBe("http://[::1]:3000");
    expect(portUrl(port({}), null)).toBeNull();
  });

  it("quotes scripts that are not shell-safe", () => {
    expect(shellWord("build:web")).toBe("build:web");
    expect(shellWord("it's")).toBe("'it'\\''s'");
    expect(scriptCommand("pnpm", "dev server")).toBe("pnpm run 'dev server'");
  });

  it("builds script requests with display for electron", () => {
    expect(scriptRequest({ ...sampleProject, framework: "electron" }, "start", false)).toMatchObject({ display: true });
    expect(scriptRequest({ ...sampleProject, framework: "vite", packageManager: null }, "dev", false)).toEqual({
      projectId: sampleProject.id,
      command: "npm run dev",
      name: "dev",
    });
    expect(scriptRequest({ ...sampleProject, framework: "vite" }, "dev", true).display).toBe(true);
  });
});
