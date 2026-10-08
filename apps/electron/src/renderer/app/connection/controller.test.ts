import { ApiError, NetworkError, ProtocolVersionError, type EventStreamHandlers, type TesseractClient } from "@tesseract/client";
import type { ServerEvent } from "@tesseract/protocol";
import { sampleHealth, sampleStatus } from "@tesseract/protocol/fixtures";
import { describe, expect, it, vi } from "vitest";
import type { ConnectionConfig, ConnectionSnapshot, DiscoveryResult } from "../../../shared/contracts/connection";
import { ConnectionController, type ConnectionDeps } from "./controller";
import { flush, manualTimers } from "./test-helpers";

const CONFIG_FILE = "/home/dev/.config/tesseract-desktop/config.json";
const FILE_CONFIG: ConnectionConfig = { apiUrl: "http://127.0.0.1:7700", token: "tok", name: "rig", pairingUrl: null, source: "file" };
const DOCKER_CONFIG: ConnectionConfig = { ...FILE_CONFIG, apiUrl: "http://172.22.0.2:7700", source: "docker", container: "tesseract-sandbox-1" };

function fakeClient() {
  const streams: EventStreamHandlers[] = [];
  const failures = { health: null as unknown, status: null as unknown };
  const client = {
    baseUrl: "http://127.0.0.1:7700",
    health: vi.fn(async () => {
      if (failures.health) throw failures.health;
      return sampleHealth;
    }),
    status: vi.fn(async () => {
      if (failures.status) throw failures.status;
      return { ...sampleStatus };
    }),
    inbox: vi.fn(async () => ({ items: [], unreadCount: 3, attentionCount: 1 })),
    openEvents: vi.fn((handlers: EventStreamHandlers) => {
      streams.push(handlers);
      handlers.onStateChange?.("connecting");
      return { state: "connecting", close: () => handlers.onStateChange?.("closed"), reconnect: () => undefined };
    }),
  };
  return { client, streams, failures, asClient: client as unknown as TesseractClient };
}

function setup(options: { config?: ConnectionConfig | null; discover?: DiscoveryResult } = {}) {
  const clock = manualTimers();
  const fake = fakeClient();
  const changed = new Set<(snapshot: ConnectionSnapshot) => void>();
  const configs: ConnectionConfig[] = [];
  const deps: ConnectionDeps = {
    load: vi.fn(async () => ({ config: options.config === undefined ? FILE_CONFIG : options.config, configFile: CONFIG_FILE })),
    save: vi.fn(async (input) => ({ config: { ...FILE_CONFIG, ...input, source: "file" as const }, configFile: CONFIG_FILE })),
    forget: vi.fn(async () => ({ config: null, configFile: CONFIG_FILE })),
    discover: vi.fn(async () => options.discover ?? { ok: false as const, error: "docker is not installed on this machine" }),
    onChanged: (listener) => {
      changed.add(listener);
      return () => changed.delete(listener);
    },
    createClient: (config) => {
      configs.push(config);
      return fake.asClient;
    },
    now: () => 1_000,
    timers: clock.timers,
  };
  const controller = new ConnectionController(deps);
  const emitChanged = (snapshot: ConnectionSnapshot) => changed.forEach((listener) => listener(snapshot));
  return { controller, deps, fake, clock, configs, emitChanged };
}

describe("ConnectionController", () => {
  it("connects with the saved config and goes online", async () => {
    const { controller, fake, clock } = setup();
    await controller.start();
    expect(controller.state.status).toBe("connecting");
    await flush();
    const state = controller.state;
    expect(state.status).toBe("online");
    expect(state.health).toEqual(sampleHealth);
    expect(state.sandbox?.sandboxId).toBe(sampleStatus.sandboxId);
    expect(state.configFile).toBe(CONFIG_FILE);
    expect(state.inbox).toEqual({ unreadCount: 3, attentionCount: 1 });
    expect(state.events).toBe("connecting");
    expect(fake.client.openEvents).toHaveBeenCalledTimes(1);
    expect(clock.pending()).toEqual([5_000]);
  });

  it("keeps the same status object when the payload did not change", async () => {
    const { controller, clock } = setup();
    await controller.start();
    await flush();
    const first = controller.state.sandbox;
    clock.fire();
    await flush();
    expect(controller.state.sandbox).toBe(first);
  });

  it("discovers when nothing is configured", async () => {
    const { controller, configs } = setup({
      config: null,
      discover: { ok: true, config: DOCKER_CONFIG, message: "Found rig at http://172.22.0.2:7700", tried: [] },
    });
    await controller.start();
    expect(configs).toEqual([DOCKER_CONFIG]);
    await flush();
    expect(controller.state.status).toBe("online");
    expect(controller.state.config?.source).toBe("docker");
  });

  it("becomes unconfigured when discovery fails without a previous config", async () => {
    const { controller } = setup({ config: null });
    await controller.start();
    expect(controller.state).toMatchObject({ status: "unconfigured", errorMessage: "docker is not installed on this machine" });
  });

  it("reconnects the previous config when rediscovery fails", async () => {
    const { controller, configs } = setup();
    await controller.start();
    await flush();
    const pending = controller.rediscover();
    expect(controller.state.status).toBe("discovering");
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(configs).toEqual([FILE_CONFIG, FILE_CONFIG]);
    expect(controller.state.status).toBe("connecting");
  });

  it("ignores a rediscovery that finishes after the user saved a connection", async () => {
    const { controller, deps, configs } = setup();
    await controller.start();
    await flush();
    let finish: (result: DiscoveryResult) => void = () => undefined;
    vi.mocked(deps.discover).mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const pending = controller.rediscover();
    await controller.save({ apiUrl: "http://10.0.0.2:7700", token: "tok2" });
    finish({ ok: true, config: DOCKER_CONFIG, message: "found", tried: [] });
    await pending;
    expect(configs.at(-1)).toMatchObject({ apiUrl: "http://10.0.0.2:7700" });
    expect(controller.state.config).toMatchObject({ apiUrl: "http://10.0.0.2:7700" });
  });

  it("maps failures to statuses and slows down for auth errors", async () => {
    const { controller, fake, clock } = setup();
    await controller.start();
    await flush();
    fake.failures.status = new NetworkError("down");
    clock.fire();
    await flush();
    expect(controller.state.status).toBe("offline");
    expect(controller.state.events).toBe("idle");
    expect(controller.state.errorMessage).toContain("Can't reach the sandbox");
    fake.failures.status = null;
    fake.failures.health = new ApiError(401, "unauthorized", "bad token");
    clock.fire();
    await flush();
    expect(controller.state.status).toBe("unauthorized");
    expect(clock.pending()).toEqual([30_000]);
  });

  it("rejects an invalid URL without creating a client", () => {
    const { controller, configs } = setup();
    controller.connect({ ...FILE_CONFIG, apiUrl: "ftp://nope" });
    expect(configs).toEqual([]);
    expect(controller.state).toMatchObject({ status: "offline", errorMessage: "Invalid controller URL: ftp://nope" });
    controller.connect({ ...FILE_CONFIG, token: " " });
    expect(controller.state.errorMessage).toBe("A controller token is required");
  });

  it("slows down while the window is hidden and refreshes when it shows", async () => {
    const { controller, fake, clock } = setup();
    await controller.start();
    await flush();
    controller.setWindowVisible(false);
    expect(clock.pending()).toEqual([30_000]);
    const calls = fake.client.health.mock.calls.length;
    controller.setWindowVisible(true);
    expect(fake.client.health.mock.calls.length).toBe(calls + 1);
  });

  it("dispatches server events and inbox counts", async () => {
    const { controller, fake } = setup();
    await controller.start();
    await flush();
    const seen: string[] = [];
    const stop = controller.subscribe("project.deleted", (event) => seen.push(event.id));
    const all: string[] = [];
    controller.subscribe("*", (event) => all.push(event.type));
    const handlers = fake.streams[0];
    handlers?.onStateChange?.("open");
    expect(controller.state.events).toBe("open");
    handlers?.onEvent({ type: "inbox.updated", unreadCount: 7, attentionCount: 0 } as ServerEvent);
    handlers?.onEvent({ type: "project.deleted", id: "tesseract" } as ServerEvent);
    stop();
    handlers?.onEvent({ type: "project.deleted", id: "other" } as ServerEvent);
    expect(controller.state.inbox).toEqual({ unreadCount: 7, attentionCount: 0 });
    expect(seen).toEqual(["tesseract"]);
    expect(all).toEqual(["inbox.updated", "project.deleted", "project.deleted"]);
  });

  it("goes incompatible when the stream announces another protocol", async () => {
    const { controller, fake } = setup();
    await controller.start();
    await flush();
    fake.streams[0]?.onError?.(new ProtocolVersionError("/v1/events", 2, 1));
    expect(controller.state.status).toBe("incompatible");
    expect(controller.state.events).toBe("incompatible");
    expect(controller.state.errorMessage).toContain("protocol v2");
  });

  it("follows config changes from other windows", async () => {
    const { controller, configs, emitChanged } = setup();
    await controller.start();
    await flush();
    emitChanged({ config: { ...FILE_CONFIG, source: "env" }, configFile: CONFIG_FILE });
    expect(configs).toHaveLength(1);
    expect(controller.state.config?.source).toBe("env");
    emitChanged({ config: DOCKER_CONFIG, configFile: CONFIG_FILE });
    expect(configs).toEqual([FILE_CONFIG, DOCKER_CONFIG]);
  });

  it("saves and forgets through the main process", async () => {
    const { controller, deps, configs } = setup();
    await controller.start();
    await flush();
    await controller.save({ apiUrl: "http://10.0.0.2:7700", token: "tok2" });
    expect(deps.save).toHaveBeenCalledWith({ apiUrl: "http://10.0.0.2:7700", token: "tok2" });
    expect(configs.at(-1)).toMatchObject({ apiUrl: "http://10.0.0.2:7700", source: "file" });
    const result = await controller.forget();
    expect(deps.forget).toHaveBeenCalled();
    expect(deps.discover).toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(controller.state.config?.apiUrl).toBe("http://10.0.0.2:7700");
  });

  it("stops polling and the stream", async () => {
    const { controller, clock } = setup();
    await controller.start();
    await flush();
    controller.stop();
    expect(clock.pending()).toEqual([]);
    expect(controller.state.events).toBe("idle");
  });
});
