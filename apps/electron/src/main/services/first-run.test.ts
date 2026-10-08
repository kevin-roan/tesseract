import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectionConfig } from "../../shared/contracts/connection";

const state = vi.hoisted(() => ({
  configFile: "",
  isTest: false,
  fixtures: false,
  found: null as ConnectionConfig | null,
  saved: [] as unknown[],
}));

vi.mock("electron", () => ({ app: {}, BrowserWindow: { getAllWindows: () => [] } }));
vi.mock("../context", () => ({
  mainContext: () => ({ configFile: state.configFile, isTest: state.isTest, fixtures: state.fixtures }),
}));
vi.mock("../windows/manager", () => ({}));
vi.mock("./idle", () => ({}));
vi.mock("../ipc/connection", () => ({
  saveConnection: async (input: unknown) => {
    state.saved.push(input);
  },
}));
vi.mock("./onboarding", async () => {
  const { updateConfig } = await import("../../core/config");
  return {
    completeOnboardingFromDiscovery: () =>
      updateConfig(state.configFile, (data) => ({ ...data, onboarding: { version: 1, step: "finish", statuses: {}, completedAt: "now" } })),
  };
});
vi.mock("../../core/connection", () => ({
  stackProject: (data: Record<string, { project?: string }>) => data.sandboxStack?.project ?? null,
  discoverHealthySandbox: vi.fn(async () => state.found),
}));

const { onboardingStepToResume } = await import("./commands");
const connection = await import("../../core/connection");

const FOUND: ConnectionConfig = {
  apiUrl: "http://127.0.0.1:7700",
  token: "t",
  name: "tesseract-test",
  pairingUrl: null,
  source: "docker",
  container: "tesseract-test-sandbox-1",
};

let dir = "";

function writeConfig(data: Record<string, unknown>): void {
  writeFileSync(state.configFile, JSON.stringify(data));
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tesseract-test-first-run-"));
  state.configFile = join(dir, "config.json");
  state.isTest = false;
  state.fixtures = false;
  state.found = null;
  state.saved = [];
  vi.mocked(connection.discoverHealthySandbox).mockClear();
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("first-run discovery", () => {
  it("adopts a healthy running sandbox and skips the wizard", async () => {
    writeConfig({ sandboxStack: { project: "tesseract-test-x" } });
    state.found = FOUND;
    expect(await onboardingStepToResume()).toBeNull();
    expect(vi.mocked(connection.discoverHealthySandbox).mock.calls[0]?.[0].project).toBe("tesseract-test-x");
    expect(state.saved).toEqual([{ apiUrl: FOUND.apiUrl, token: "t", name: "tesseract-test", pairingUrl: null }]);
    expect(JSON.parse(readFileSync(state.configFile, "utf8")).onboarding.completedAt).toBe("now");
  });

  it("opens the wizard when nothing healthy is found", async () => {
    writeConfig({ onboarding: { step: "claude", statuses: {} } });
    expect(await onboardingStepToResume()).toBe("claude");
    expect(connection.discoverHealthySandbox).toHaveBeenCalledTimes(1);
    expect(state.saved).toEqual([]);
  });

  it("doesn't run discovery when onboarding is done or a connection exists", async () => {
    writeConfig({ onboarding: { completedAt: "2026-10-06T00:00:00Z" } });
    expect(await onboardingStepToResume()).toBeNull();
    writeConfig({ url: "http://127.0.0.1:7700", token: "t" });
    expect(await onboardingStepToResume()).toBeNull();
    expect(connection.discoverHealthySandbox).not.toHaveBeenCalled();
  });

  it("never discovers in test or fixture profiles", async () => {
    writeConfig({});
    state.found = FOUND;
    state.isTest = true;
    expect(await onboardingStepToResume()).toBe("welcome");
    state.isTest = false;
    state.fixtures = true;
    expect(await onboardingStepToResume()).toBe("welcome");
    expect(connection.discoverHealthySandbox).not.toHaveBeenCalled();
  });
});
