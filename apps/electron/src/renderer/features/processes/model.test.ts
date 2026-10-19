import type { RuntimeEntry } from "@tesseract/protocol";
import { describe, expect, it } from "vitest";
import { sampleHostAndroidStatus, sampleHostIosStatus, sampleSimDevice } from "@tesseract/protocol/fixtures";
import { connectionEmpty, connectionNotice, entryRow, formatCpu, formatMemory, hostDeviceSnapshots, processGroups, projectNames, runningCount, stateStatus } from "./model";
import type { HostDeviceSnapshot } from "./types";

const NOW = Date.parse("2026-01-01T12:00:00Z") / 1000;

function entry(overrides: Partial<RuntimeEntry> = {}): RuntimeEntry {
  return {
    kind: "process",
    id: "p1",
    name: "dev server",
    detail: "bun run dev",
    pid: 4242,
    projectId: "web",
    startedAt: "2026-01-01T11:55:00Z",
    state: "running",
    cpuPercent: 12.5,
    memoryBytes: 150 * 1024 * 1024,
    supervised: false,
    canStop: true,
    ...overrides,
  };
}

const emulator: HostDeviceSnapshot = { id: "android", state: "running", name: "Pixel_8_API_35", detail: "emulator-5554", startedAt: "2026-01-01T11:00:00Z" };
const projects = projectNames([{ id: "web", name: "Web app" }]);

describe("processes model", () => {
  it("builds a row with pid, project, uptime, cpu and memory", () => {
    const row = entryRow(entry(), projects, NOW);
    expect(row.key).toBe("process:p1");
    expect(row.title).toBe("dev server");
    expect(row.subtitle).toBe("bun run dev");
    expect(row.meta).toBe("PID 4242 · Web app · up 5m · 12.5% CPU · 150 MB");
    expect(row.status).toEqual({ label: "Running", tone: "success", live: true });
    expect(row.target).toEqual({ group: "process", id: "p1", name: "dev server", supervised: false });
  });

  it("drops missing fields and falls back to ids", () => {
    const row = entryRow(entry({ name: "", detail: null, pid: null, projectId: "other", startedAt: null, cpuPercent: null, memoryBytes: null }), projects, NOW);
    expect(row.title).toBe("p1");
    expect(row.subtitle).toBeNull();
    expect(row.meta).toBe("other");
  });

  it("adds the supervised hint to the subtitle", () => {
    expect(entryRow(entry({ supervised: true }), projects, NOW).subtitle).toBe("bun run dev · Supervised — will restart");
    expect(entryRow(entry({ supervised: true, detail: null }), projects, NOW).subtitle).toBe("Supervised — will restart");
  });

  it("groups entries in kind order and appends an active host emulator", () => {
    const groups = processGroups(
      [entry({ kind: "vnc", id: "vnc" }), entry({ kind: "browser", id: "chrome" }), entry({ id: "p2" }), entry()],
      [emulator],
      projects,
      NOW,
    );
    expect(groups.map((group) => group.id)).toEqual(["process", "browser", "vnc", "emulator"]);
    expect(groups[0]?.rows.map((row) => row.target.id)).toEqual(["p2", "p1"]);
    expect(groups[3]?.rows[0]).toMatchObject({ title: "Pixel_8_API_35", subtitle: "emulator-5554", meta: "up 1h", canStop: true });
  });

  it("hides a stopped emulator and counts running things", () => {
    const stopped: HostDeviceSnapshot = { ...emulator, state: "stopped" };
    expect(processGroups([], [stopped], projects, NOW)).toEqual([]);
    expect(runningCount([entry(), entry({ id: "p2" })], [emulator])).toBe(3);
    expect(runningCount(null, [stopped])).toBe(0);
  });

  it("lists a running emulator and a booted simulator as host devices", () => {
    const android = { ...sampleHostAndroidStatus, emulator: { ...sampleHostAndroidStatus.emulator, state: "running" as const, avd: "Pixel_9", serial: "emulator-5554" } };
    const devices = hostDeviceSnapshots(android, sampleHostIosStatus);
    expect(devices.map((device) => [device.id, device.state, device.name])).toEqual([
      ["android", "running", "Pixel_9"],
      ["ios", "running", sampleSimDevice.name],
    ]);
    const rows = processGroups([], devices, projects, NOW)[0]?.rows ?? [];
    expect(rows.map((row) => row.target)).toEqual([
      { group: "emulator", id: "android", name: "Pixel_9", supervised: false },
      { group: "emulator", id: "ios", name: sampleSimDevice.name, supervised: false },
    ]);
    expect(rows[1]?.subtitle).toBe("iOS Simulator · iOS 26.0");
    expect(hostDeviceSnapshots(null, { ...sampleHostIosStatus, booted: null, devices: [{ ...sampleSimDevice, state: "shutdown" }] })).toEqual([]);
  });

  it("maps states to tones", () => {
    expect(stateStatus("stopping")).toEqual({ label: "Stopping", tone: "warning", live: false });
    expect(stateStatus("zombie")).toEqual({ label: "Zombie", tone: "neutral", live: false });
  });

  it("formats cpu and memory", () => {
    expect(formatCpu(3)).toBe("3% CPU");
    expect(formatCpu(null)).toBeNull();
    expect(formatMemory(0)).toBeNull();
    expect(formatMemory(2048)).toBe("2 KB");
  });

  it("describes the connection when offline", () => {
    expect(connectionEmpty("online", null)).toBeNull();
    const offline = connectionEmpty("offline", "ECONNREFUSED");
    expect(offline).toMatchObject({ title: "Sandbox unreachable", message: "ECONNREFUSED", action: "retry", loading: false });
    expect(connectionNotice(offline)).toMatchObject({ title: "Sandbox unreachable", message: "ECONNREFUSED" });
    expect(connectionNotice(connectionEmpty("connecting", null))).toMatchObject({ title: undefined, message: "Connecting…" });
  });
});
