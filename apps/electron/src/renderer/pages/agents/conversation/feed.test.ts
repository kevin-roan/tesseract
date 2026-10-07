import type { AgentRunHandlers, StreamConnection } from "@theone/client";
import type { AgentRun, AgentRunDetail } from "@theone/protocol";
import { describe, expect, it, vi } from "vitest";
import { mergeRun, RunFeed, type FeedClient, type FeedTimers } from "./feed";

const TS = "2026-10-07T10:00:00.000Z";

const run = (overrides: Partial<AgentRun> = {}): AgentRun => ({
  id: "run_a",
  projectId: null,
  prompt: "p",
  mode: null,
  attachments: [],
  sessionId: "s",
  claudeAccountId: null,
  state: "running",
  startedAt: TS,
  endedAt: null,
  usage: null,
  result: null,
  error: null,
  archivedAt: null,
  ...overrides,
});

const detail = (overrides: Partial<AgentRun> = {}, events: AgentRunDetail["events"] = []): AgentRunDetail => ({ ...run(overrides), events });

function fakeClient() {
  const streams: { id: string; handlers: AgentRunHandlers; closed: boolean }[] = [];
  const responses: (AgentRunDetail | Error)[] = [];
  const client: FeedClient = {
    getAgentRun: vi.fn(async () => {
      const next = responses.shift();
      if (!next) throw new Error("no response queued");
      if (next instanceof Error) throw next;
      return next;
    }),
    openAgentRun: vi.fn((id: string, handlers: AgentRunHandlers) => {
      const stream = { id, handlers, closed: false };
      streams.push(stream);
      return { state: "connecting", close: () => void (stream.closed = true), reconnect: () => undefined } as StreamConnection;
    }),
  };
  return { client, streams, responses };
}

function fakeTimers() {
  const callbacks = new Map<number, () => void>();
  let next = 1;
  const timers: FeedTimers = {
    setInterval: (callback) => {
      callbacks.set(next, callback);
      return next++;
    },
    clearInterval: (handle) => callbacks.delete(handle as number),
  };
  return { timers, tick: () => [...callbacks.values()].forEach((callback) => callback()), size: () => callbacks.size };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

describe("RunFeed", () => {
  it("fetches a finished run over REST and stays idle", async () => {
    const { client, responses } = fakeClient();
    responses.push(detail({ state: "succeeded" }, [{ kind: "text", seq: 1, ts: TS, text: "hi" }]));
    const onRun = vi.fn();
    const feed = new RunFeed({ describeError, onRun });
    feed.setClient(client);
    feed.select("run_a");
    feed.resume();
    expect(feed.getSnapshot().link).toBe("loading");
    await flush();
    const snapshot = feed.getSnapshot();
    expect(snapshot.run?.state).toBe("succeeded");
    expect(snapshot.run).not.toHaveProperty("events");
    expect(snapshot.log.size).toBe(1);
    expect(snapshot.link).toBe("idle");
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("streams a running run and refetches when the stream ends", async () => {
    const { client, streams, responses } = fakeClient();
    const feed = new RunFeed({ describeError });
    feed.setClient(client);
    feed.select("run_a", run());
    feed.resume();
    expect(streams).toHaveLength(1);
    const handlers = streams[0]!.handlers;
    handlers.onStateChange?.("open");
    expect(feed.getSnapshot().link).toBe("live");
    handlers.onEvent?.({ kind: "text", seq: 1, ts: TS, text: "working" });
    expect(feed.getSnapshot().log.size).toBe(1);
    handlers.onStateChange?.("connecting");
    expect(feed.getSnapshot().link).toBe("reconnecting");
    handlers.onClose?.({ code: 1006, reason: "", willReconnect: true });
    expect(feed.getSnapshot().link).toBe("reconnecting");
    handlers.onRun?.(run({ state: "succeeded" }));
    expect(feed.getSnapshot().run?.state).toBe("succeeded");
    responses.push(detail({ state: "succeeded", result: "done" }));
    handlers.onClose?.({ code: 1000, reason: "", willReconnect: false });
    await flush();
    expect(feed.getSnapshot()).toMatchObject({ link: "idle", run: { result: "done" } });
  });

  it("opens the stream after fetching a running run", async () => {
    const { client, streams, responses } = fakeClient();
    responses.push(detail());
    const feed = new RunFeed({ describeError });
    feed.setClient(client);
    feed.select("run_a");
    feed.resume();
    await flush();
    expect(streams).toHaveLength(1);
  });

  it("ignores results of a run that is no longer selected", async () => {
    const { client, streams, responses } = fakeClient();
    const feed = new RunFeed({ describeError });
    feed.setClient(client);
    feed.select("run_a", run());
    feed.resume();
    const stale = streams[0]!.handlers;
    responses.push(detail({ id: "run_b", state: "failed" }));
    feed.select("run_b");
    feed.resume();
    expect(streams[0]!.closed).toBe(true);
    stale.onEvent?.({ kind: "text", seq: 9, ts: TS, text: "late" });
    await flush();
    expect(feed.getSnapshot()).toMatchObject({ runId: "run_b", run: { state: "failed" } });
    expect(feed.getSnapshot().log.size).toBe(0);
  });

  it("reports fetch errors and recovers on reload", async () => {
    const { client, responses } = fakeClient();
    responses.push(new Error("offline"));
    const feed = new RunFeed({ describeError });
    feed.setClient(client);
    feed.select("run_a");
    feed.resume();
    await flush();
    expect(feed.getSnapshot()).toMatchObject({ error: "offline", link: "idle", run: null });
    responses.push(detail({ state: "cancelled" }));
    feed.reload();
    await flush();
    expect(feed.getSnapshot()).toMatchObject({ error: null, run: { state: "cancelled" } });
  });

  it("polls when no socket can be created", async () => {
    const { client, responses } = fakeClient();
    const timers = fakeTimers();
    const feed = new RunFeed({ describeError, canStream: () => false, timers: timers.timers });
    feed.setClient(client);
    feed.select("run_a", run());
    responses.push(detail({}, [{ kind: "text", seq: 1, ts: TS, text: "a" }]));
    feed.resume();
    expect(feed.getSnapshot().link).toBe("polling");
    await flush();
    expect(feed.getSnapshot().log.size).toBe(1);
    responses.push(detail({ state: "succeeded" }));
    timers.tick();
    await flush();
    expect(feed.getSnapshot()).toMatchObject({ link: "idle", run: { state: "succeeded" } });
    expect(timers.size()).toBe(0);
  });

  it("never moves a final run back to running from the list", () => {
    const feed = new RunFeed({ describeError });
    feed.select("run_a", run({ state: "succeeded" }));
    feed.updateRun(run({ state: "running" }));
    expect(feed.getSnapshot().run?.state).toBe("succeeded");
    feed.updateRun(run({ state: "succeeded", archivedAt: TS }));
    expect(feed.getSnapshot().run?.archivedAt).toBe(TS);
    expect(mergeRun(run(), run())).toBeNull();
  });
});
