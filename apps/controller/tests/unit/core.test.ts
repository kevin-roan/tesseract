import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mapLimit } from "../../src/core/concurrency";
import { badRequest, conflict, errorMessage, forbidden, HttpError, notFound, unavailable } from "../../src/core/errors";
import { EventHub } from "../../src/core/events";
import { childEnv, resolveExecutable, run, runBytes } from "../../src/core/exec";
import { LineSplitter } from "../../src/core/line-splitter";
import { createLogger, isLogLevel, silentLogger, type LogLevel } from "../../src/core/logger";
import { isInside, locateProject, realpathOrNull, requireProjectId } from "../../src/core/paths";
import { findPortOwner } from "../../src/core/ports";
import { listPids, readProcStat } from "../../src/core/proc";
import { describeLeftovers, groupAlive, groupLeftovers, groupMembers, signalGroup } from "../../src/core/process-group";
import { RingBuffer } from "../../src/core/ring-buffer";
import { nowIso, toUtcIso } from "../../src/core/time";
import { makeTempDir, removeTempDirs } from "../helpers";

afterEach(removeTempDirs);

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

function capture(level: LogLevel = "debug") {
  const lines: { line: string; level: LogLevel }[] = [];
  const logger = createLogger(level, "test", (line, target) => lines.push({ line, level: target }));
  return { logger, lines };
}

describe("RingBuffer", () => {
  test("rejects capacities that are not positive integers", () => {
    for (const capacity of [0, -1, 1.5, Number.NaN]) expect(() => new RingBuffer(capacity)).toThrow(RangeError);
  });

  test("keeps the newest items in insertion order once it wraps", () => {
    const ring = new RingBuffer<number>(3);
    expect(ring.toArray()).toEqual([]);
    for (let i = 1; i <= 5; i += 1) ring.push(i);
    expect(ring.size).toBe(3);
    expect(ring.toArray()).toEqual([3, 4, 5]);
    expect(ring.last(2)).toEqual([4, 5]);
    expect(ring.last(10)).toEqual([3, 4, 5]);
    expect(ring.last(0)).toEqual([]);
    expect(ring.last(-4)).toEqual([]);
  });

  test("last() with a fractional count never returns holes", () => {
    const ring = new RingBuffer<number>(4);
    for (let i = 1; i <= 3; i += 1) ring.push(i);
    expect(ring.last(1.5)).toEqual([3]);
    expect(ring.last(Number.NaN)).toEqual([]);
  });
});

describe("mapLimit", () => {
  test("preserves order and never exceeds the limit", async () => {
    let active = 0;
    let peak = 0;
    const results = await mapLimit([5, 1, 4, 2, 3], 2, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await Bun.sleep(value);
      active -= 1;
      return value * 10;
    });
    expect(results).toEqual([50, 10, 40, 20, 30]);
    expect(peak).toBe(2);
  });

  test("handles empty input", async () => {
    expect(await mapLimit([], 4, async () => 1)).toEqual([]);
  });

  test("still runs every task when the limit is below one", async () => {
    expect(await mapLimit([1, 2, 3], 0, async (value) => value + 1)).toEqual([2, 3, 4]);
    expect(await mapLimit([1, 2], -3, async (value) => value)).toEqual([1, 2]);
  });

  test("rejects when a task fails", async () => {
    await expect(
      mapLimit([1, 2], 2, async (value) => {
        if (value === 2) throw new Error("boom");
        return value;
      }),
    ).rejects.toThrow("boom");
  });
});

describe("errors", () => {
  test("factories map to protocol codes and statuses", () => {
    expect([badRequest("a"), notFound("b"), conflict("c"), unavailable("d"), forbidden("e")].map((e) => [e.code, e.status])).toEqual([
      ["bad_request", 400],
      ["not_found", 404],
      ["conflict", 409],
      ["unavailable", 503],
      ["forbidden", 403],
    ]);
    const custom = new HttpError("bad_request", "x", 418);
    expect(custom.status).toBe(418);
    expect(custom.name).toBe("HttpError");
    expect(custom).toBeInstanceOf(Error);
  });

  test("errorMessage accepts anything", () => {
    expect(errorMessage(new Error("m"))).toBe("m");
    expect(errorMessage("s")).toBe("s");
    expect(errorMessage(42)).toBe("42");
    expect(errorMessage(null)).toBe("null");
  });
});

describe("EventHub", () => {
  test("isolates failing listeners and supports unsubscribe", () => {
    const { logger, lines } = capture();
    const hub = new EventHub(logger);
    const seen: string[] = [];
    hub.subscribe(() => {
      throw new Error("listener broke");
    });
    const off = hub.subscribe((event) => seen.push(event.type));
    hub.publish({ type: "ping" } as never);
    expect(seen).toEqual(["ping"]);
    expect(lines.some((entry) => entry.level === "warn" && entry.line.includes("listener broke"))).toBe(true);
    off();
    hub.publish({ type: "ping" } as never);
    expect(seen).toEqual(["ping"]);
  });
});

describe("logger", () => {
  test("filters by level and routes through the sink", () => {
    const { logger, lines } = capture("warn");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(lines.map((entry) => entry.level)).toEqual(["warn", "error"]);
    expect(lines[0]?.line).toMatch(/^\d{4}-\d\d-\d\dT\S+Z WARN  \[test\] w$/);
    expect(logger.level).toBe("warn");
  });

  test("formats fields safely and quotes what needs quoting", () => {
    const { logger, lines } = capture();
    logger.info("msg", {
      plain: "a/b:c@d-1.2",
      spaced: "two words",
      empty: "",
      injected: "line\nfake",
      number: 3,
      nothing: undefined,
      nil: null,
      object: { a: 1 },
      error: new Error("bad thing"),
      fn: () => 1,
    });
    const line = lines[0]?.line ?? "";
    expect(line).toContain(" plain=a/b:c@d-1.2");
    expect(line).toContain(' spaced="two words"');
    expect(line).toContain(' empty=""');
    expect(line).toContain(' injected="line\\nfake"');
    expect(line).toContain(" number=3");
    expect(line).not.toContain("nothing=");
    expect(line).toContain(" nil=null");
    expect(line).toContain(' object={"a":1}');
    expect(line).toContain(' error="bad thing"');
    expect(line).toContain(" fn=");
    expect(line.split("\n")).toHaveLength(1);
  });

  test("never throws on values JSON cannot encode", () => {
    const { logger, lines } = capture();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => logger.warn("odd", { big: 10n, circular })).not.toThrow();
    expect(lines[0]?.line).toContain(" big=10");
    expect(lines[0]?.line).toContain(" circular=");
  });

  test("children extend the scope, empty field sets add nothing", () => {
    const { logger, lines } = capture();
    logger.child("http").child("ws").info("x", {});
    expect(lines[0]?.line).toMatch(/\[test:http:ws\] x$/);
  });

  test("isLogLevel and the silent logger", () => {
    expect(["debug", "info", "warn", "error"].every(isLogLevel)).toBe(true);
    expect(isLogLevel("trace")).toBe(false);
    expect(() => silentLogger.error("nothing")).not.toThrow();
  });

  test("the default sink writes warnings to stderr and the rest to stdout", () => {
    const writes: string[] = [];
    const out = process.stdout.write.bind(process.stdout);
    const err = process.stderr.write.bind(process.stderr);
    process.stdout.write = ((chunk: string) => writes.push(`out:${chunk}`)) as unknown as typeof process.stdout.write;
    process.stderr.write = ((chunk: string) => writes.push(`err:${chunk}`)) as unknown as typeof process.stderr.write;
    try {
      const logger = createLogger("debug", "sink");
      logger.info("i");
      logger.error("e");
    } finally {
      process.stdout.write = out;
      process.stderr.write = err;
    }
    expect(writes[0]).toMatch(/^out:.*\[sink\] i\n$/);
    expect(writes[1]).toMatch(/^err:.*\[sink\] e\n$/);
  });
});

describe("LineSplitter", () => {
  test("joins partial chunks and multi-byte characters split across chunks", () => {
    const splitter = new LineSplitter();
    const bytes = new TextEncoder().encode("héllo\nwor");
    expect(splitter.push(bytes.subarray(0, 2))).toEqual([]);
    expect(splitter.push(bytes.subarray(2))).toEqual(["héllo"]);
    expect(splitter.push("ld\r\n")).toEqual(["world"]);
    expect(splitter.flush()).toEqual([]);
  });

  test("collapses carriage-return progress updates unless disabled", () => {
    expect(new LineSplitter().push("10%\r50%\r100%\n")).toEqual(["100%"]);
    expect(new LineSplitter().push("\r\r\n")).toEqual([""]);
    expect(new LineSplitter({ collapseCarriageReturns: false }).push("a\rb\n")).toEqual(["a\rb"]);
  });

  test("splits runaway lines and keeps the remainder pending", () => {
    const splitter = new LineSplitter({ maxLineChars: 4 });
    expect(splitter.push("abcdefghij")).toEqual(["abcd", "efgh"]);
    expect(splitter.push("k\n0123456789\n")).toEqual(["ijk", "0123", "4567", "89"]);
    expect(splitter.push("xy")).toEqual([]);
    expect(splitter.flush()).toEqual(["xy"]);
  });

  test("never splits a surrogate pair when it cuts long lines", () => {
    const splitter = new LineSplitter({ maxLineChars: 4 });
    const lines = [...splitter.push("abc😀def\n"), ...splitter.push("xyz😀😀"), ...splitter.flush()];
    expect(lines.join("")).toBe("abc😀defxyz😀😀");
    for (const line of lines) expect(LONE_SURROGATE.test(line)).toBe(false);
  });
});

describe("time", () => {
  test("nowIso and toUtcIso", () => {
    expect(toUtcIso(nowIso())).not.toBeNull();
    expect(toUtcIso("2024-01-02T03:04:05+02:00")).toBe("2024-01-02T01:04:05.000Z");
    expect(toUtcIso(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(toUtcIso("not a date")).toBeNull();
    expect(toUtcIso("")).toBeNull();
  });
});

describe("paths", () => {
  test("isInside", () => {
    expect(isInside("/a", "/a")).toBe(true);
    expect(isInside("/a", "/a/b/c")).toBe(true);
    expect(isInside("/a", "/a/..b")).toBe(true);
    expect(isInside("/a", "/ab")).toBe(false);
    expect(isInside("/a", "/")).toBe(false);
    expect(isInside("/a/b", "/a/c")).toBe(false);
  });

  test("requireProjectId rejects traversal and truncates the echoed input", () => {
    expect(requireProjectId("my-app")).toBe("my-app");
    for (const bad of ["..", "a/b", "", "-rf"]) expect(() => requireProjectId(bad)).toThrow(HttpError);
    try {
      requireProjectId(`/${"x".repeat(500)}`);
    } catch (error) {
      expect((error as Error).message.length).toBeLessThan(120);
    }
  });

  test("locateProject resolves directories and refuses escapes", () => {
    const root = makeTempDir("paths");
    const projects = join(root, "projects");
    mkdirSync(join(projects, "real"), { recursive: true });
    mkdirSync(join(root, "outside"));
    writeFileSync(join(projects, "file"), "x");
    symlinkSync(join(projects, "real"), join(projects, "alias"));
    symlinkSync(join(root, "outside"), join(projects, "escape"));
    symlinkSync(projects, join(projects, "loop"));
    symlinkSync(join(projects, "nowhere"), join(projects, "dangling"));
    writeFileSync(join(root, "outside", "f"), "x");
    symlinkSync(join(projects, "file"), join(projects, "filelink"));

    expect(locateProject(projects, "real")).toEqual({ id: "real", path: realpathOrNull(join(projects, "real")) ?? "", exists: true });
    expect(locateProject(projects, "alias").exists).toBe(true);
    expect(locateProject(projects, "missing")).toMatchObject({ id: "missing", exists: false });
    expect(() => locateProject(projects, "escape")).toThrow(/outside the workspace/);
    expect(() => locateProject(projects, "loop")).toThrow(/outside the workspace/);
    expect(() => locateProject(projects, "dangling")).toThrow(/outside the workspace/);
    expect(() => locateProject(projects, "file")).toThrow(/not a directory/);
    expect(() => locateProject(projects, "filelink")).toThrow(/not a directory/);
    expect(realpathOrNull(join(root, "nope"))).toBeNull();
  });
});

describe("exec", () => {
  test("childEnv drops controller secrets without touching the source", () => {
    const source = { THEONE_TOKEN: "t", THEONE_VNC_PASSWORD: "p", PATH: "/bin" };
    expect(childEnv(source)).toEqual({ PATH: "/bin" });
    expect(source.THEONE_TOKEN).toBe("t");
  });

  test("run captures stdout, stderr, exit code and stdin", async () => {
    const result = await run(["bash", "-c", 'read line; echo "got $line"; echo oops >&2; exit 3'], { stdin: "hi\n" });
    expect(result).toMatchObject({ ok: false, code: 3, stdout: "got hi\n", stderr: "oops\n", timedOut: false, error: null });
    const ok = await run(["pwd"], { cwd: "/tmp" });
    expect(ok.ok).toBe(true);
    expect(ok.stdout.trim()).toBe("/tmp");
  });

  test("uses childEnv unless an env is given", async () => {
    process.env.THEONE_VNC_PASSWORD = "leak-check";
    try {
      const inherited = await run(["bash", "-c", 'echo "${THEONE_VNC_PASSWORD:-none}"']);
      expect(inherited.stdout.trim()).toBe("none");
      const explicit = await run(["bash", "-c", 'echo "$X"'], { env: { X: "given", PATH: process.env.PATH } });
      expect(explicit.stdout.trim()).toBe("given");
    } finally {
      delete process.env.THEONE_VNC_PASSWORD;
    }
  });

  test("kills the whole group on timeout", async () => {
    const started = Date.now();
    const result = await runBytes(["bash", "-c", "sleep 30 & sleep 30"], { timeoutMs: 100 });
    expect(result.timedOut).toBe(true);
    expect(result.ok).toBe(false);
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  test("reports spawn failures instead of throwing", async () => {
    const result = await run(["/nonexistent/binary"]);
    expect(result.ok).toBe(false);
    expect(result.code).toBeNull();
    expect(result.error).toBeTruthy();
    expect(result.stdout).toBe("");
  });

  test("resolveExecutable", () => {
    expect(resolveExecutable("")).toBeNull();
    expect(resolveExecutable("bash")).toMatch(/\/bash$/);
    expect(resolveExecutable("bash", "/nonexistent")).toBeNull();
    expect(resolveExecutable("definitely-not-a-binary-xyz")).toBeNull();
  });
});

describe("proc and process groups", () => {
  test("readProcStat parses commands containing spaces and parentheses", async () => {
    const dir = makeTempDir("proc");
    const script = join(dir, "we (ird) name");
    writeFileSync(script, "#!/bin/sh\nsleep 5\n", { mode: 0o755 });
    const proc = Bun.spawn([script], { detached: true });
    try {
      const stat = readProcStat(proc.pid);
      expect(stat).not.toBeNull();
      expect(stat?.pid).toBe(proc.pid);
      expect(stat?.pgrp).toBe(proc.pid);
      expect(stat?.session).toBe(proc.pid);
      expect(["R", "S", "D"]).toContain(stat?.state ?? "");
      expect(listPids()).toContain(proc.pid);
      expect(groupAlive(proc.pid)).toBe(true);
      expect(groupMembers(proc.pid)?.map((member) => member.pid)).toContain(proc.pid);
      expect(groupLeftovers(proc.pid).map((leftover) => leftover.pid)).toContain(proc.pid);
    } finally {
      signalGroup(proc.pid, "SIGKILL");
      await proc.exited;
    }
    expect(readProcStat(2 ** 22 + 12345)).toBeNull();
    expect(signalGroup(2 ** 22 + 12345, 0)).toBe(false);
    expect(groupAlive(2 ** 22 + 12345)).toBe(false);
  });

  test("describeLeftovers lists at most five", () => {
    expect(describeLeftovers([{ pid: 1, command: "a" }])).toBe("Stopping 1 process left running in the process group: a (1)");
    const many = Array.from({ length: 7 }, (_, i) => ({ pid: i, command: `c${i}` }));
    expect(describeLeftovers(many)).toBe(
      "Stopping 7 processes left running in the process group: c0 (0), c1 (1), c2 (2), c3 (3), c4 (4) and 2 more",
    );
  });
});

describe("ports", () => {
  test("findPortOwner finds this process for its own listener and nothing for a free port", () => {
    const server = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
    try {
      const owner = findPortOwner(server.port);
      expect(owner?.pid).toBe(process.pid);
      expect(owner?.command.length).toBeGreaterThan(0);
    } finally {
      server.stop(true);
    }
    expect(findPortOwner(server.port)).toBeNull();
  });
});
