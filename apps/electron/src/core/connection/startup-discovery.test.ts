import { describe, expect, it, vi } from "vitest";
import type { ConnectionConfig, DiscoveryResult } from "../../shared/contracts/connection";
import { discoverHealthySandbox, discoveryDisabled } from "./discovery";

const CONFIG: ConnectionConfig = {
  apiUrl: "http://127.0.0.1:7700",
  token: "t",
  name: "tesseract-test",
  pairingUrl: "http://127.0.0.1:7700",
  source: "docker",
  container: "tesseract-test-sandbox-1",
};

function found(outcome: "ok" | "unreachable"): DiscoveryResult {
  return { ok: true, config: CONFIG, message: "", tried: [[CONFIG.apiUrl, outcome]] };
}

describe("discoverHealthySandbox", () => {
  it("returns the config only when a candidate answered", async () => {
    expect(await discoverHealthySandbox({ env: {}, discover: async () => found("ok") })).toEqual(CONFIG);
    expect(await discoverHealthySandbox({ env: {}, discover: async () => found("unreachable") })).toBeNull();
    expect(await discoverHealthySandbox({ env: {}, discover: async () => ({ ok: false, error: "no docker" }) })).toBeNull();
    expect(await discoverHealthySandbox({ env: {}, discover: async () => Promise.reject(new Error("boom")) })).toBeNull();
  });

  it("passes the stack project and gives up after the timeout", async () => {
    let signal: AbortSignal | undefined;
    const discover = vi.fn((options: { project?: string; signal?: AbortSignal }) => {
      signal = options.signal;
      return new Promise<DiscoveryResult>(() => undefined);
    });
    const started = Date.now();
    expect(await discoverHealthySandbox({ env: {}, project: "tesseract-test-a", timeoutMs: 20, discover })).toBeNull();
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(discover.mock.calls[0]?.[0].project).toBe("tesseract-test-a");
    expect(signal?.aborted).toBe(true);
  });

  it("is skipped when TESSERACT_DISABLE_DISCOVERY=1", async () => {
    const discover = vi.fn(async () => found("ok"));
    expect(discoveryDisabled({ TESSERACT_DISABLE_DISCOVERY: "1" })).toBe(true);
    expect(discoveryDisabled({})).toBe(false);
    expect(await discoverHealthySandbox({ env: { TESSERACT_DISABLE_DISCOVERY: "1" }, discover })).toBeNull();
    expect(discover).not.toHaveBeenCalled();
  });
});
