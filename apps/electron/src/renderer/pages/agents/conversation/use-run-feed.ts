import type { AgentRun, AgentRunEvent } from "@theone/protocol";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useApiClient } from "../../../app/data";
import { describeError } from "../../../app/connection";
import { isFixtureMode } from "../../../app/runtime";
import { EMPTY_EVENT_LOG, orderedEvents } from "../timeline/model";
import { RunFeed, type FeedSnapshot } from "./feed";

export interface RunFeedState extends FeedSnapshot {
  events: AgentRunEvent[];
  reload(): void;
  updateRun(run: AgentRun): void;
}

const canStream = () => isFixtureMode() || typeof globalThis.WebSocket !== "undefined";

export function useRunFeed(runId: string | null, initialRun: AgentRun | null, active: boolean, onRun?: (run: AgentRun) => void): RunFeedState {
  const client = useApiClient();
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;
  const [feed] = useState(() => new RunFeed({ describeError, canStream, onRun: (run) => onRunRef.current?.(run) }));
  const initialRef = useRef(initialRun);
  initialRef.current = initialRun;

  useLayoutEffect(() => {
    if (feed.getSnapshot().runId !== runId) feed.select(runId, initialRef.current);
  }, [feed, runId]);

  useEffect(() => {
    feed.setClient(client);
  }, [feed, client]);

  useEffect(() => {
    if (!active) return undefined;
    feed.resume();
    return () => feed.stop();
  }, [feed, active, runId, client]);

  useEffect(() => {
    if (initialRun) feed.updateRun(initialRun);
  }, [feed, initialRun]);

  useEffect(() => () => feed.stop(), [feed]);

  const stored = useSyncExternalStore(feed.subscribe, feed.getSnapshot, feed.getSnapshot);
  const snapshot = useMemo<FeedSnapshot>(
    () => (stored.runId === runId ? stored : { runId, run: initialRun?.id === runId ? initialRun : null, log: EMPTY_EVENT_LOG, link: "idle", error: null }),
    [stored, runId, initialRun],
  );
  const events = useMemo(() => orderedEvents(snapshot.log), [snapshot.log]);
  return useMemo(
    () => ({ ...snapshot, events, reload: () => feed.reload(), updateRun: (run: AgentRun) => feed.updateRun(run) }),
    [snapshot, events, feed],
  );
}
