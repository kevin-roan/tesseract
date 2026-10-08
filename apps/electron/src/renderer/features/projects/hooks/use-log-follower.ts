import type { StreamConnection, TesseractClient } from "@tesseract/client";
import { isFinalBuildState, type BuildJob, type LogLine as ProtocolLogLine, type ProcessInfo } from "@tesseract/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { describeError, useConnectionClient } from "../../../app/connection";
import { useLogBuffer } from "../../../components/LogView";
import { LOG_SNAPSHOT_INTERVAL_MS, LOG_SNAPSHOT_TAIL } from "../constants";
import { LOG_LABELS } from "../labels";
import { buildStateStatus, isLiveProcess, logStatus } from "../model";
import type { LogStatus } from "../types";

export type FollowKind = "process" | "build";

export interface LogFollowerOptions {
  visible?: boolean;
  onUpdate?(item: ProcessInfo | BuildJob): void;
  onExit?(code: number | null): void;
}

interface Target {
  kind: FollowKind;
  id: string;
  serial: number;
}

type Item = ProcessInfo | BuildJob;

function isFinal(kind: FollowKind, item: Item): boolean {
  return kind === "process" ? !isLiveProcess(item as ProcessInfo) : isFinalBuildState((item as BuildJob).state);
}

function exitCodeOf(kind: FollowKind, item: Item): number | null {
  if (kind === "process") return (item as ProcessInfo).exitCode;
  return (item as BuildJob).state === "succeeded" ? 0 : 1;
}

function fetchItem(client: TesseractClient, target: Target, signal?: AbortSignal): Promise<Item> {
  return target.kind === "process" ? client.getProcess(target.id, { signal }) : client.getBuild(target.id, { signal });
}

function fetchLines(client: TesseractClient, target: Target, signal?: AbortSignal): Promise<ProtocolLogLine[]> {
  const query = { tail: LOG_SNAPSHOT_TAIL };
  return target.kind === "process" ? client.processLogs(target.id, query, { signal }) : client.buildLogs(target.id, query, { signal });
}

const toInput = (line: ProtocolLogLine) => ({ text: line.text, stream: line.stream, seq: line.seq });

export function useLogFollower({ visible = true, onUpdate, onExit }: LogFollowerOptions = {}) {
  const client = useConnectionClient();
  const buffer = useLogBuffer();
  const [target, setTarget] = useState<Target | null>(null);
  const [status, setStatus] = useState<LogStatus | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const ended = useRef(false);
  const lastBuild = useRef<BuildJob | null>(null);
  const callbacks = useRef({ onUpdate, onExit });
  callbacks.current = { onUpdate, onExit };
  const serial = useRef(0);
  const { appendLines, clear } = buffer;

  const follow = useCallback(
    (kind: FollowKind, id: string) => {
      serial.current += 1;
      ended.current = false;
      lastBuild.current = null;
      clear();
      setNotice(null);
      setStatus(null);
      setTarget({ kind, id, serial: serial.current });
    },
    [clear],
  );

  const stop = useCallback(() => {
    serial.current += 1;
    setTarget(null);
  }, []);

  useEffect(() => {
    if (!target || !visible || !client || ended.current) return undefined;
    const current = target;
    const alive = () => serial.current === current.serial;
    const controller = new AbortController();
    let connection: StreamConnection | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const finish = (code: number | null) => {
      if (ended.current || !alive()) return;
      ended.current = true;
      const build = lastBuild.current;
      setStatus((current.kind === "build" && build ? buildStateStatus(build.state) : null) ?? logStatus("closed", code, true));
      callbacks.current.onExit?.(code);
    };

    const update = (item: Item) => {
      if (current.kind === "build") lastBuild.current = item as BuildJob;
      callbacks.current.onUpdate?.(item);
    };

    const checkOnce = async () => {
      try {
        const item = await fetchItem(client, current, controller.signal);
        if (!alive()) return;
        update(item);
        if (isFinal(current.kind, item)) finish(exitCodeOf(current.kind, item));
      } catch (error) {
        if (alive() && !controller.signal.aborted) setNotice(describeError(error));
      }
    };

    const snapshot = () => {
      setNotice(LOG_LABELS.snapshot);
      const tick = async () => {
        try {
          const [lines, item] = await Promise.all([fetchLines(client, current, controller.signal), fetchItem(client, current, controller.signal)]);
          if (!alive()) return;
          appendLines(lines.map(toInput));
          update(item);
          if (isFinal(current.kind, item)) {
            if (timer) clearInterval(timer);
            finish(exitCodeOf(current.kind, item));
          }
        } catch (error) {
          if (alive() && !controller.signal.aborted) setNotice(describeError(error));
        }
      };
      void tick();
      timer = setInterval(() => void tick(), LOG_SNAPSHOT_INTERVAL_MS);
    };

    const handlers = {
      onLine: (line: ProtocolLogLine) => alive() && appendLines([toInput(line)]),
      onExit: (code: number | null) => finish(code),
      onBuild: (build: BuildJob) => alive() && update(build),
      onStateChange: (state: "connecting" | "open" | "closed") => {
        if (!alive() || ended.current) return;
        setStatus(logStatus(state));
        if (state === "closed") void checkOnce();
      },
    };

    try {
      connection =
        current.kind === "process"
          ? client.openProcessLogs(current.id, handlers, { reconnect: true })
          : client.openBuildLogs(current.id, handlers, { reconnect: true });
    } catch {
      snapshot();
    }

    return () => {
      controller.abort();
      connection?.close();
      if (timer) clearInterval(timer);
    };
  }, [target, visible, client, appendLines]);

  useEffect(() => () => void (serial.current += 1), []);

  return { lines: buffer.lines, status, notice, target, follow, stop };
}

export type LogFollower = ReturnType<typeof useLogFollower>;
