import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createLogger, silentLogger, type LogLevel } from "../../src/core/logger";
import { LogChannel, logFilePath, LogStore, type LogEvent } from "../../src/core/log-store";
import { makeTempDir, removeTempDirs } from "../helpers";

afterEach(removeTempDirs);

function recordingLogger() {
  const lines: { line: string; level: LogLevel }[] = [];
  return { lines, logger: createLogger("debug", "logs", (line, level) => lines.push({ line, level })) };
}

describe("LogChannel", () => {
  test("numbers lines, flattens newlines and writes the documented file format", () => {
    const dir = makeTempDir("logs");
    const channel = new LogChannel("p1", dir, 1024 * 1024, 10, silentLogger);
    const first = channel.append("stdout", "hello\r\nworld");
    channel.append("stderr", "oops");
    expect(first).toMatchObject({ seq: 1, stream: "stdout", text: "hello world" });
    channel.flush();
    const content = readFileSync(logFilePath(dir, "p1"), "utf8");
    expect(content).toMatch(/^\S+Z stdout 1 hello world\n\S+Z stderr 2 oops\n$/);
    expect(statSync(logFilePath(dir, "p1")).mode & 0o777).toBe(0o600);
  });

  test("flushes on a timer when nobody calls flush", async () => {
    const dir = makeTempDir("logs");
    const channel = new LogChannel("p2", dir, 1024 * 1024, 10, silentLogger);
    channel.append("stdout", "later");
    expect(existsSync(logFilePath(dir, "p2"))).toBe(false);
    await Bun.sleep(350);
    expect(readFileSync(logFilePath(dir, "p2"), "utf8")).toContain("later");
  });

  test("flushes immediately once 64 KiB are pending", () => {
    const dir = makeTempDir("logs");
    const channel = new LogChannel("p3", dir, 10 * 1024 * 1024, 10, silentLogger);
    const text = "x".repeat(1024);
    for (let i = 0; i < 70; i += 1) channel.append("stdout", text);
    expect(statSync(logFilePath(dir, "p3")).size).toBeGreaterThanOrEqual(64 * 1024);
    channel.flush();
  });

  test("delivers events, isolates failing listeners and ends exactly once", () => {
    const dir = makeTempDir("logs");
    const { logger, lines } = recordingLogger();
    const channel = new LogChannel("p4", dir, 1024, 10, logger);
    const events: LogEvent[] = [];
    channel.subscribe(() => {
      throw new Error("listener failed");
    });
    const off = channel.subscribe((event) => events.push(event));
    channel.append("stdout", "a");
    expect(lines.some((entry) => entry.level === "warn" && entry.line.includes("listener failed"))).toBe(true);
    expect(channel.ended).toBe(false);
    channel.end(7);
    channel.end(9);
    expect(channel.ended).toBe(true);
    expect(channel.exitCode).toBe(7);
    expect(events.map((event) => event.type)).toEqual(["line", "end"]);
    expect(events[1]).toEqual({ type: "end", code: 7 });
    off();
    const late: LogEvent[] = [];
    channel.subscribe((event) => late.push(event))();
    channel.append("stdout", "after end");
    expect(late).toEqual([]);
    channel.flush();
  });

  test("tail comes from the ring buffer", () => {
    const channel = new LogChannel("p5", makeTempDir("logs"), 1024, 3, silentLogger);
    for (const text of ["1", "2", "3", "4"]) channel.append("stdout", text);
    expect(channel.tail(10).map((line) => line.text)).toEqual(["2", "3", "4"]);
    expect(channel.tail(1).map((line) => line.text)).toEqual(["4"]);
    channel.flush();
  });

  test("a write failure is logged, not thrown", () => {
    const dir = makeTempDir("logs");
    const { logger, lines } = recordingLogger();
    const channel = new LogChannel("p6", join(dir, "missing-dir"), 1024, 10, logger);
    channel.append("stdout", "lost");
    expect(() => channel.flush()).not.toThrow();
    expect(lines.some((entry) => entry.line.includes("log write failed"))).toBe(true);
  });

  test("rotation keeps writing when the log file was removed underneath it", () => {
    const dir = makeTempDir("logs");
    const { logger, lines } = recordingLogger();
    const path = logFilePath(dir, "p7");
    const channel = new LogChannel("p7", dir, 200, 10, logger);
    channel.append("stdout", "a".repeat(100));
    channel.flush();
    rmSync(path);
    channel.append("stdout", "b".repeat(150));
    channel.flush();
    channel.append("stdout", "c".repeat(10));
    channel.flush();
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, "utf8")).toContain("c".repeat(10));
    expect(lines.filter((entry) => entry.line.includes("log write failed"))).toHaveLength(0);
  });
});

describe("LogStore", () => {
  test("tail reads the disk (current then rotated file) once a channel is evicted", () => {
    const dir = makeTempDir("logs");
    writeFileSync(
      `${logFilePath(dir, "old")}.1`,
      ["2024-01-01T00:00:00.000Z stdout 1 one", "2024-01-01T00:00:00.000Z stdout 2 two"].join("\n") + "\n",
    );
    writeFileSync(
      logFilePath(dir, "old"),
      ["2024-01-01T00:00:01.000Z stderr 3 three has  spaces", "garbage line", "2024-01-01T00:00:02.000Z system 4 four"].join("\n") + "\n",
    );
    const store = new LogStore(dir, silentLogger);
    expect(store.get("old")).toBeUndefined();
    expect(store.tail("old", 2).map((line) => line.text)).toEqual(["four"]);
    expect(store.tail("old", 5).map((line) => line.text)).toEqual(["one", "two", "three has  spaces", "four"]);
    expect(store.tail("old", 5)[2]).toEqual({ ts: "2024-01-01T00:00:01.000Z", stream: "stderr", seq: 3, text: "three has  spaces" });
    expect(store.tail("unknown", 5)).toEqual([]);
    expect(store.tail("old", 0)).toEqual([]);
  });

  test("tail of a large file reads backwards in growing chunks", () => {
    const dir = makeTempDir("logs");
    const line = (i: number) => `2024-01-01T00:00:00.000Z stdout ${i} ${"z".repeat(1000)}-${i}`;
    writeFileSync(logFilePath(dir, "big"), Array.from({ length: 600 }, (_, i) => line(i + 1)).join("\n") + "\n");
    const tail = new LogStore(dir, silentLogger).tail("big", 400);
    expect(tail).toHaveLength(400);
    expect(tail[0]?.seq).toBe(201);
    expect(tail.at(-1)?.seq).toBe(600);
  });

  test("open, get, flushAll and eviction of ended channels past 64", () => {
    const dir = makeTempDir("logs");
    const store = new LogStore(dir, silentLogger, { ringLines: 5, rotateBytes: 1024 });
    const live = store.open("live");
    live.append("stdout", "still here");
    for (let i = 0; i < 70; i += 1) {
      const channel = store.open(`ended-${i}`);
      channel.append("stdout", `line ${i}`);
      channel.end(0);
    }
    store.open("trigger");
    expect(store.get("live")).toBe(live);
    expect(store.get("ended-0")).toBeUndefined();
    expect(store.get("ended-69")).toBeDefined();
    expect(store.tail("ended-0", 5).map((line) => line.text)).toEqual(["line 0"]);
    store.flushAll();
    expect(readFileSync(logFilePath(dir, "live"), "utf8")).toContain("still here");
  });

  test("a channel whose directory is read-only keeps its ring buffer", () => {
    const dir = makeTempDir("logs");
    chmodSync(dir, 0o500);
    try {
      const store = new LogStore(dir, silentLogger);
      const channel = store.open("ro");
      channel.append("stdout", "in memory");
      store.flushAll();
      expect(store.tail("ro", 1).map((line) => line.text)).toEqual(["in memory"]);
    } finally {
      chmodSync(dir, 0o700);
    }
  });
});
