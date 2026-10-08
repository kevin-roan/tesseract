import type { SandboxStatus } from "@tesseract/protocol";
import { sampleStatus } from "@tesseract/protocol/fixtures";
import { describe, expect, it } from "vitest";
import { INITIAL_CONNECTION_STATE, type ConnectionState, type MetricsSample } from "../../app/connection";
import {
  attentionNotice,
  chartSeries,
  countItems,
  defaultHidden,
  displayRows,
  emptyModel,
  legendItems,
  loadThreshold,
  overviewMeta,
  overviewTitle,
  rangeSeconds,
  resourceColumns,
  resourceItems,
  seriesSummaries,
  toolRows,
} from "./model";

const GIB = 1024 ** 3;
const NOW = Date.parse("2026-10-07T12:00:00Z") / 1000;

const status: SandboxStatus = {
  ...sampleStatus,
  sandboxId: "tesseract-sandbox",
  hostname: "tesseract-sandbox",
  version: "0.1.0",
  startedAt: "2026-10-07T04:14:00Z",
  uptimeSec: 7 * 3600 + 46 * 60,
  resources: {
    cpu: { cores: 4, load1: 11.99, load5: 6.85, load15: 4.47 },
    memory: { totalBytes: 8 * GIB, usedBytes: 6.3 * GIB },
    disk: { path: "/workspace", totalBytes: 100 * GIB, usedBytes: 81.8 * GIB },
  },
  counts: { projects: 4, runningProcesses: 1, activeBuilds: 0, terminals: 2, agentRuns: 0 },
};

const state = (patch: Partial<ConnectionState>): ConnectionState => ({ ...INITIAL_CONNECTION_STATE, ...patch });

const sample = (t: number, load1: number, gapBefore = false): MetricsSample => ({
  t,
  cores: 4,
  load1,
  load5: 2,
  load15: 1,
  memUsed: 4,
  memTotal: 8,
  diskUsed: 1,
  diskTotal: 4,
  gapBefore,
});

describe("overview model", () => {
  it("builds the header title and meta line", () => {
    expect(overviewTitle(status, state({}))).toBe("tesseract-sandbox");
    expect(overviewTitle(null, state({ config: { apiUrl: "http://x", token: "t", name: "box", pairingUrl: null, source: "file" } }))).toBe("box");
    expect(overviewTitle(null, state({}))).toBe("Sandbox");
    expect(overviewMeta(status)).toBe("up 7h 46m · tesseract-sandbox · v0.1.0");
    expect(overviewMeta(null)).toBeNull();
  });

  it("builds the resource tiles", () => {
    const [cpu, memory, disk, uptime] = resourceItems(status, NOW);
    expect(cpu).toMatchObject({ id: "cpu", label: "CPU load", value: "11.99", unit: "load avg", progress: 1, tone: "violet", caption: "4 cores · 5m 6.85 · 15m 4.47" });
    expect(memory).toMatchObject({ value: "6.3", unit: "GB", tone: "neutral", caption: "of 8 GB" });
    expect(memory?.progress).toBeCloseTo(0.7875);
    expect(disk).toMatchObject({ value: "81.8", unit: "GB", caption: "of 100 GB · /workspace" });
    expect(uptime).toMatchObject({ value: "7h 46m", caption: "since 7h ago" });
    expect(uptime?.progress).toBeUndefined();
  });

  it("marks usage at or above 85% as warning", () => {
    const busy = { ...status, resources: { ...status.resources, memory: { totalBytes: 100, usedBytes: 85 } } };
    expect(resourceItems(busy, NOW)[1]?.tone).toBe("violet");
  });

  it("builds activity, display and tool rows", () => {
    expect(countItems(status).map((item) => [item.label, item.value, item.target.page])).toEqual([
      ["Projects", "4", "projects"],
      ["Running processes", "1", "terminals"],
      ["Active builds", "0", "files"],
      ["Terminals", "2", "terminals"],
      ["Claude runs", "0", "agents"],
    ]);
    expect(displayRows(status)).toEqual([
      ["X display", ":1 · Available"],
      ["Resolution", "1600×900"],
      ["VNC", "Port 5901 · Available"],
    ]);
    const blank = { ...status, display: { ...status.display, available: false, width: null, height: null, vnc: { ...status.display.vnc, available: false } } };
    expect(displayRows(blank).map(([, value]) => value)).toEqual([":1 · Unavailable", "—", "Port 5901 · Unavailable"]);
    expect(toolRows(status)).toContainEqual(["claude", "not installed"]);
    expect(toolRows({ ...status, tools: [] })).toEqual([]);
  });

  it("maps connection states to empty states", () => {
    expect(emptyModel(state({ status: "unconfigured" }))).toMatchObject({
      title: "Connect to your sandbox",
      icon: "sandbox",
      loading: false,
      primary: { label: "Discover", action: "rediscover" },
      secondary: { label: "Preferences", action: "preferences" },
    });
    expect(emptyModel(state({ status: "online" }))).toMatchObject({ title: "Connecting…", loading: true, icon: null, primary: null });
    expect(emptyModel(state({ status: "discovering" }))).toMatchObject({ title: "Looking for the sandbox…", loading: true });
    expect(emptyModel(state({ status: "offline", errorMessage: "boom" }))).toMatchObject({ title: "Sandbox unreachable", message: "boom", primary: { action: "retry" } });
    expect(emptyModel(state({ status: "unauthorized" }))).toMatchObject({ title: "Token rejected", primary: { label: "Rediscover" } });
    expect(emptyModel(state({ status: "incompatible", errorMessage: "v2" }))).toMatchObject({
      title: "Version mismatch",
      message: "v2",
      primary: { label: "Preferences", action: "preferences" },
      secondary: null,
    });
  });

  it("builds the attention notice", () => {
    expect(attentionNotice({ unreadCount: 3, attentionCount: 0 })).toBeNull();
    expect(attentionNotice({ unreadCount: 1, attentionCount: 1 })?.message).toBe("1 session waiting for input or permission.");
    expect(attentionNotice({ unreadCount: 2, attentionCount: 2 })).toMatchObject({ title: "Claude needs you", tone: "warning", actionLabel: "Open Inbox", message: "2 sessions waiting for input or permission." });
  });

  it("builds history series, summaries and legend items", () => {
    const samples = [sample(NOW - 120, 2), sample(NOW - 60, 4), sample(NOW - 10, 8, true)];
    const series = chartSeries(samples);
    expect(series.map((item) => item.key)).toEqual(["load1", "memory", "disk", "load5", "load15"]);
    expect(series[0]).toMatchObject({ fill: true, color: 0 });
    expect(series[0]?.points).toEqual([[NOW - 120, 0.5], [NOW - 60, 1], [NOW - 10, null], [NOW - 10, 2]]);
    const summaries = seriesSummaries(samples, NOW - 90);
    expect(summaries.load1).toEqual({ value: "200%", caption: "avg 150% · peak 200%" });
    expect(seriesSummaries([], NOW).memory).toEqual({ value: null, caption: "No samples in range" });
    const legend = legendItems(summaries);
    expect(legend[2]).toMatchObject({ key: "disk", label: "Disk", value: "25%", color: 2 });
    expect(legend[3]).toMatchObject({ key: "load5", dash: [6, 5] });
    expect(defaultHidden()).toEqual(["load5", "load15"]);
    expect(loadThreshold()).toEqual({ value: 0.85, label: "85% warning" });
    expect(rangeSeconds("5m")).toBe(300);
    expect(rangeSeconds("1h")).toBe(3600);
  });
});

describe("resourceColumns", () => {
  it("fits four tiles at the reference width and falls back to two", () => {
    expect(resourceColumns(645)).toBe(4);
    expect(resourceColumns(624)).toBe(4);
    expect(resourceColumns(600)).toBe(2);
    expect(resourceColumns(0)).toBe(2);
  });
});
