import { afterAll, beforeAll, expect, test } from "bun:test";
import { ServerEventSchema, type ServerEvent } from "@tesseract/protocol";
import { makeTempDir, removeTempDirs, startTestController, upgradeStatus, writeFiles, type TestController } from "./helpers";

let t: TestController;

beforeAll(async () => {
  const workspace = makeTempDir("events");
  writeFiles(workspace, { "projects/app/.keep": "" });
  t = await startTestController({ workspace, controller: { pingIntervalMs: 150 } });
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

test("sends hello first, then pings", async () => {
  const socket = await t.socket("/v1/events");
  const first = ServerEventSchema.parse(await socket.waitFor(() => true));
  expect(first).toEqual({ type: "hello", protocolVersion: 1, sandboxId: "test-sandbox" });
  await socket.waitFor((message: ServerEvent) => message.type === "ping", 2_000);
  socket.send({ type: "pong" });
  socket.close();
});

test("broadcasts status events posted by the agent to every client", async () => {
  const a = await t.socket("/v1/events");
  const b = await t.socket("/v1/events");
  const response = await t.request("POST", "/v1/events", {
    project: "expensifo",
    status: "building",
    platform: "android",
    stage: "gradle",
    message: "Compiling release build",
  });
  expect(response.status).toBe(202);
  expect(await response.text()).toBe("");
  for (const socket of [a, b]) {
    const event = ServerEventSchema.parse(await socket.waitFor((message: ServerEvent) => message.type === "status"));
    expect(event.type === "status" && event.event).toMatchObject({
      project: "expensifo",
      status: "building",
      platform: "android",
      stage: "gradle",
      message: "Compiling release build",
    });
    expect(event.type === "status" && Date.parse(event.event.ts)).toBeGreaterThan(0);
    socket.close();
  }
});

test("rejects malformed status events", async () => {
  expect((await t.json("POST", "/v1/events", { status: "", message: "x", project: null })).status).toBe(400);
  expect((await t.json("POST", "/v1/events", { status: "done" })).status).toBe(400);
});

test("publishes process updates as full objects", async () => {
  const socket = await t.socket("/v1/events");
  const { body } = await t.json<{ id: string }>("POST", "/v1/processes", { projectId: "app", command: "echo hi" });
  const updates: string[] = [];
  await socket.waitFor((message: ServerEvent) => {
    if (message.type === "process.updated" && message.process.id === body.id) updates.push(message.process.state);
    return updates.includes("exited");
  });
  expect(updates[0]).toBe("running");
  for (const message of socket.messages) ServerEventSchema.parse(message);
  socket.close();
});

test("plain GET on a WebSocket path asks for an upgrade", async () => {
  const response = await t.request("GET", "/v1/events");
  expect(response.status).toBe(400);
  expect((await upgradeStatus(`${t.wsBase}/v1/processes/prc_nothing00/logs/stream?ticket=${await t.ticket()}`)).status).toBe(404);
});
