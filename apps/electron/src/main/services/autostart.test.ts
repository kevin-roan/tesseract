import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AutostartOutcome } from "../../core/sandbox";

const state = vi.hoisted(() => ({
  isTest: false,
  fixtures: false,
  enabled: true,
  outcome: { kind: "skip", reason: "running" } as AutostartOutcome,
  notifications: [] as { id?: string; title: string }[],
  events: [] as [string, unknown][],
}));

vi.mock("electron", () => ({ app: {}, Notification: {}, BrowserWindow: { getAllWindows: () => [] } }));
vi.mock("../context", () => ({
  mainContext: () => ({ configFile: "/tmp/monolith-test/config.json", isTest: state.isTest, fixtures: state.fixtures }),
}));
vi.mock("./resources", () => ({ sandboxContext: () => ({ contextDir: "/ctx", envFile: "/tmp/monolith-test/.env", env: {} }) }));
vi.mock("./settings", () => ({ currentSettings: () => ({ sandboxAutostart: state.enabled }) }));
vi.mock("./notifications", () => ({
  showNotification: (notification: { id?: string; title: string }) => {
    state.notifications.push(notification);
    return true;
  },
}));
vi.mock("../ipc/_framework/events", () => ({
  serviceEmitter: () => ({ emit: (event: string, payload: unknown) => state.events.push([event, payload]) }),
}));
vi.mock("../../core/sandbox", async (original) => ({
  ...(await original<typeof import("../../core/sandbox")>()),
  runAutostart: vi.fn(async (_context: unknown, enabled: boolean, callbacks: { onLog?(line: string): void }) => {
    callbacks.onLog?.("Starting");
    return enabled ? state.outcome : { kind: "skip", reason: "disabled" };
  }),
}));

const sandbox = await import("../../core/sandbox");

async function load() {
  vi.resetModules();
  return import("./autostart");
}

beforeEach(() => {
  state.isTest = false;
  state.fixtures = false;
  state.enabled = true;
  state.notifications = [];
  state.events = [];
  vi.mocked(sandbox.runAutostart).mockClear();
});

describe("sandbox autostart at launch", () => {
  it("runs once in the background with the saved setting and streams log lines", async () => {
    state.outcome = { kind: "started", project: "monolith-test", status: { configured: true, project: "monolith-test", services: [] } };
    const { startSandboxAutostart } = await load();
    const first = startSandboxAutostart();
    expect(startSandboxAutostart()).toBe(first);
    expect(await first).toEqual(state.outcome);
    expect(sandbox.runAutostart).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sandbox.runAutostart).mock.calls[0]?.[1]).toBe(true);
    expect(state.events).toEqual([
      ["log", "Starting"],
      ["status", { configured: true, project: "monolith-test", services: [] }],
    ]);
    expect(state.notifications).toEqual([]);
  });

  it("passes a disabled setting through", async () => {
    state.enabled = false;
    const { startSandboxAutostart } = await load();
    expect(await startSandboxAutostart()).toEqual({ kind: "skip", reason: "disabled" });
    expect(state.notifications).toEqual([]);
  });

  it("never runs in test or fixture profiles", async () => {
    state.isTest = true;
    expect((await load()).startSandboxAutostart()).toBeNull();
    state.isTest = false;
    state.fixtures = true;
    expect((await load()).startSandboxAutostart()).toBeNull();
    expect(sandbox.runAutostart).not.toHaveBeenCalled();
  });

  it("notifies once when Docker isn't reachable or compose fails", async () => {
    const { reportAutostart } = await load();
    reportAutostart({ kind: "skip", reason: "docker-unreachable", detail: "Cannot connect" });
    reportAutostart({ kind: "failed", project: "monolith-test", message: "port is already allocated" });
    reportAutostart({ kind: "skip", reason: "not-managed" });
    expect(state.notifications.map((notification) => notification.title)).toEqual([
      sandbox.SANDBOX_LABELS.autostart.dockerTitle,
      sandbox.SANDBOX_LABELS.autostart.failedTitle,
    ]);
  });
});
