import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TerminalInfoSchema, TerminalListSchema, TerminalServerMessageSchema, type TerminalInfo } from "@theone/protocol";
import { groupMembers } from "../src/core/process-group";
import { trimScrollback } from "../src/services/terminals";
import {
  labelledPid,
  makeTempDir,
  openStalledSocket,
  processGone,
  removeTempDirs,
  startTestController,
  writeFiles,
  type TestController,
  type WsClient,
} from "./helpers";

let t: TestController;

type Output = { type: "output"; data: string } | { type: "exit"; code: number | null };

const outputText = (socket: WsClient) =>
  socket.messages
    .map((message) => TerminalServerMessageSchema.parse(message))
    .map((message) => (message.type === "output" ? message.data : ""))
    .join("");

const waitForOutput = (socket: WsClient, needle: string, timeoutMs = 8_000) =>
  socket.waitFor<Output>(() => outputText(socket).includes(needle), timeoutMs);

async function createTerminal(body: Record<string, unknown> = {}): Promise<TerminalInfo> {
  const { status, body: info } = await t.json("POST", "/v1/terminals", { kind: "shell", cols: 80, rows: 24, ...body });
  if (status !== 201) throw new Error(`create failed ${status} ${JSON.stringify(info)}`);
  return TerminalInfoSchema.parse(info);
}

beforeAll(async () => {
  const workspace = makeTempDir("term");
  writeFiles(workspace, { "projects/site/index.html": "<h1>hi</h1>\n" });
  t = await startTestController({ workspace });
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

describe("PTY sessions", () => {
  test("round-trips input and output over the WebSocket", async () => {
    const info = await createTerminal({ projectId: "site" });
    expect(info).toMatchObject({ kind: "shell", state: "running", projectId: "site", cols: 80, rows: 24 });
    expect(info.cwd.endsWith("/projects/site")).toBe(true);
    const socket = await t.socket(`/v1/terminals/${info.id}/stream`);
    socket.send({ type: "input", data: "echo hello-$((40+2)); echo TERM=$TERM; pwd\r" });
    await waitForOutput(socket, "hello-42");
    await waitForOutput(socket, "TERM=xterm-256color");
    await waitForOutput(socket, "/projects/site");
    socket.close();
  });

  test("resizes the PTY", async () => {
    const info = await createTerminal();
    const socket = await t.socket(`/v1/terminals/${info.id}/stream`);
    socket.send({ type: "resize", cols: 101, rows: 33 });
    socket.send({ type: "input", data: "stty size\r" });
    await waitForOutput(socket, "33 101");
    const listed = TerminalListSchema.parse((await t.json("GET", "/v1/terminals")).body).find((terminal) => terminal.id === info.id);
    expect(listed).toMatchObject({ cols: 101, rows: 33 });
    socket.send({ type: "resize", cols: 0, rows: 5 });
    socket.send({ type: "input", data: "stty size\r" });
    await socket.waitFor(() => outputText(socket).match(/^33 101\r$/gm)?.length === 2, 3_000);
    socket.close();
  });

  test("replays scrollback on reattach and fans out to several clients", async () => {
    const info = await createTerminal();
    const first = await t.socket(`/v1/terminals/${info.id}/stream`);
    first.send({ type: "input", data: "echo marker-$((6*7))\r" });
    await waitForOutput(first, "marker-42");
    first.close();
    await first.closed;

    const second = await t.socket(`/v1/terminals/${info.id}/stream`);
    const replay = TerminalServerMessageSchema.parse(await second.waitFor(() => true));
    expect(replay.type).toBe("output");
    expect(replay.type === "output" && replay.data.includes("marker-42")).toBe(true);

    const third = await t.socket(`/v1/terminals/${info.id}/stream`);
    third.send({ type: "input", data: "echo shared-$((1+1))\r" });
    await waitForOutput(second, "shared-2");
    await waitForOutput(third, "shared-2");
    second.close();
    third.close();
  });

  test("reports exit to attached clients and events", async () => {
    const info = await createTerminal();
    const events = await t.socket("/v1/events");
    const socket = await t.socket(`/v1/terminals/${info.id}/stream`);
    socket.send({ type: "input", data: "exit 7\r" });
    expect(await socket.waitFor<Output>((message) => message.type === "exit")).toEqual({ type: "exit", code: 7 });
    expect((await socket.closed).code).toBe(1000);
    const update = await events.waitFor<{ type: string; terminal?: TerminalInfo }>(
      (message) => message.type === "terminal.updated" && message.terminal?.id === info.id && message.terminal.state === "exited",
    );
    expect(update.terminal?.exitCode).toBe(7);
    events.close();

    const late = await t.socket(`/v1/terminals/${info.id}/stream`);
    expect(await late.waitFor<Output>((message) => message.type === "exit")).toEqual({ type: "exit", code: 7 });
  });

  test("stops background jobs the shell leaves behind when it exits", async () => {
    const info = await createTerminal();
    const socket = await t.socket(`/v1/terminals/${info.id}/stream`);
    socket.send({ type: "input", data: "sleep 300 & echo job=$!\r" });
    await socket.waitFor(() => /job=\d+/.test(outputText(socket)));
    const job = labelledPid(outputText(socket), "job");
    expect(processGone(job)).toBe(false);
    socket.send({ type: "input", data: "exit\r" });
    expect(await socket.waitFor<Output>((message) => message.type === "exit")).toEqual({ type: "exit", code: 0 });
    expect(processGone(job)).toBe(true);
    expect(groupMembers(info.pid ?? 0)).toEqual([]);
  });

  test("DELETE hangs up a running shell", async () => {
    const info = await createTerminal();
    const socket = await t.socket(`/v1/terminals/${info.id}/stream`);
    socket.send({ type: "input", data: "sleep 300\r" });
    await Bun.sleep(200);
    const { status, body } = await t.json("DELETE", `/v1/terminals/${info.id}`);
    expect(status).toBe(200);
    expect(TerminalInfoSchema.parse(body).state).toBe("exited");
    await socket.waitFor<Output>((message) => message.type === "exit");
    const list = TerminalListSchema.parse((await t.json("GET", "/v1/terminals")).body);
    expect(list.some((terminal) => terminal.id === info.id)).toBe(false);
  });

  test("claude terminals need the claude binary", async () => {
    const { status, body } = await t.json<{ error: { code: string } }>("POST", "/v1/terminals", { kind: "claude", cols: 80, rows: 24 });
    expect(status).toBe(503);
    expect(body.error.code).toBe("unavailable");
  });

  test("a client that stops reading is disconnected instead of silently losing output", async () => {
    const slow = await startTestController({ controller: { wsBackpressureLimitBytes: 64 * 1024 } });
    try {
      const info = TerminalInfoSchema.parse((await slow.json("POST", "/v1/terminals", { kind: "shell", cols: 80, rows: 24 })).body);
      const stalled = await openStalledSocket(slow, `/v1/terminals/${info.id}/stream`);
      const reader = await slow.socket(`/v1/terminals/${info.id}/stream`);
      reader.send({ type: "input", data: "head -c 8000000 /dev/zero | tr '\\0' x | fold -w 200; echo flood-$((6*7))-done\r" });
      await reader.waitFor((message: Output) => message.type === "output" && message.data.includes("flood-42-done"), 20_000);
      reader.close();
      stalled.resume();
      await stalled.closed;
      stalled.end();
      const listed = TerminalListSchema.parse((await slow.json("GET", "/v1/terminals")).body).find((terminal) => terminal.id === info.id);
      expect(listed?.state).toBe("running");
    } finally {
      await slow.stop();
    }
  }, 30_000);

  test("unknown terminals cannot be attached", async () => {
    await expect(t.socket("/v1/terminals/trm_unknown00/stream")).rejects.toThrow();
  });
});

test("scrollback trimming keeps the newest output", () => {
  const chunks = ["aaaa\nbbbb\ncc", "dd\n", "eeee"];
  const size = trimScrollback(chunks, 19, 12);
  expect(chunks.join("")).toBe("ccdd\neeee");
  expect(size).toBe(9);
  const single = ["x".repeat(50)];
  expect(trimScrollback(single, 50, 20)).toBe(20);
  expect(single[0]?.length).toBe(20);
});

test("scrollback trimming counts UTF-8 bytes and never splits a character", () => {
  const accented = ["é".repeat(10)];
  expect(trimScrollback(accented, 20, 7)).toBe(6);
  expect(accented).toEqual(["ééé"]);
  const emoji = ["😀😀"];
  expect(trimScrollback(emoji, 8, 5)).toBe(4);
  expect(emoji).toEqual(["😀"]);
  const box = ["─".repeat(1000)];
  const size = trimScrollback(box, 3000, 1024);
  expect(size).toBeLessThanOrEqual(1024);
  expect(Buffer.byteLength(box.join(""))).toBe(size);
  expect(box.join("")).toBe("─".repeat(size / 3));
});
