import { describe, expect, it } from "vitest";
import { fixtureFetch } from "../fetch";
import { CLONE_PROCESS_ID } from "../projects/data";
import { FixtureSocket } from "../socket";

const call = async (method: string, path: string, body?: unknown) => {
  const response = await fixtureFetch(`http://127.0.0.1:7700${path}`, {
    method,
    headers: {},
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: new AbortController().signal,
  });
  return { status: response.status, body: JSON.parse((await response.text()) || "null") };
};

const firstFrame = (path: string) =>
  new Promise<unknown>((resolve) => {
    const socket = new FixtureSocket(`ws://127.0.0.1:7700${path}`);
    socket.onmessage = (event) => {
      resolve(JSON.parse(String(event.data)));
      socket.close();
    };
    setTimeout(() => resolve(null), 20);
  });

describe("projects-tabs fixtures", () => {
  it("serves the java ports for streaxfit", async () => {
    const { body } = await call("GET", "/v1/ports");
    const ports = (body.ports as { port: number; projectId: string }[]).filter((port) => port.projectId === "streaxfit");
    expect(ports.map((port) => port.port)).toEqual([41653, 41769]);
  });

  it("starts processes and builds and serves logs", async () => {
    const process = await call("POST", "/v1/processes", { projectId: "tesseract", command: "bun run lint", name: "lint" });
    expect(process.body).toMatchObject({ projectId: "tesseract", name: "lint", state: "starting" });
    const build = await call("POST", "/v1/builds", { projectId: "hybrid-pos", target: "web", profile: "release" });
    expect(build.body).toMatchObject({ target: "web", profile: "release", state: "queued" });
    const logs = await call("GET", "/v1/builds/bld_x/logs");
    expect(logs.body.length).toBeGreaterThan(0);
  });

  it("streams log lines but leaves the clone stream to the projects fixtures", async () => {
    expect(await firstFrame("/v1/processes/prc_streaxfitdev1/logs/stream")).toMatchObject({ type: "log" });
    expect(await firstFrame(`/v1/processes/${CLONE_PROCESS_ID}/logs/stream`)).toMatchObject({ type: "log", line: { stream: "stderr" } });
  });
});
