import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { ServerEvent } from "@tesseract/protocol";
import { client, e2e, SECONDS } from "./lib/env";
import { exec, execOk } from "./lib/sandbox";
import { recordEvents, type EventRecorder } from "./lib/wait";

type StatusServerEvent = Extract<ServerEvent, { type: "status" }>;

function statusWithMessage(message: string) {
  return (event: ServerEvent): event is StatusServerEvent => event.type === "status" && event.event.message === message;
}

let recorder: EventRecorder;

beforeAll(async () => {
  recorder = await recordEvents();
});

afterAll(() => recorder.close());

describe("status events", () => {
  test("POST /v1/events reaches the events socket", async () => {
    const message = `from-rest-${crypto.randomUUID()}`;
    await client.publishStatus({ project: null, status: "e2e", stage: "rest", message });
    const { event } = await recorder.next("REST status", statusWithMessage(message));
    expect(event).toMatchObject({ project: null, status: "e2e", stage: "rest", message });
    expect(Date.parse(event.ts)).not.toBeNaN();
  });

  test(
    "tesseract-controller emit reaches the events socket",
    async () => {
      const message = `from-cli-${crypto.randomUUID()}`;
      const output = await execOk(["tesseract-controller", "emit", "--status", "e2e", "--stage", "cli", "--platform", "linux", "--message", message]);
      expect(output).toContain("emitted e2e");
      const { event } = await recorder.next("CLI status", statusWithMessage(message));
      expect(event).toMatchObject({ status: "e2e", stage: "cli", platform: "linux", message });
    },
    30 * SECONDS,
  );
});

describe("tesseract-controller api", () => {
  test("GET /v1/projects returns JSON without leaking the token", async () => {
    const result = await exec(["tesseract-controller", "api", "GET", "/v1/projects"]);
    expect(result.code).toBe(0);
    expect(Array.isArray(JSON.parse(result.stdout))).toBe(true);
    expect(result.stdout + result.stderr).not.toContain(e2e.token);
  });

  test("GET /v1/display redacts the VNC password", async () => {
    const result = await exec(["tesseract-controller", "api", "GET", "/v1/display"]);
    expect(result.code).toBe(0);
    const display = JSON.parse(result.stdout) as { vnc: { password: string | null } };
    expect(display.vnc.password).toBe("***");
    expect(result.stdout).not.toContain(e2e.vncPassword);
  });

  test("POST with a stdin body publishes an event", async () => {
    const message = `from-api-${crypto.randomUUID()}`;
    const result = await exec(["tesseract-controller", "api", "POST", "/v1/events", "-"], {
      stdin: JSON.stringify({ project: null, status: "e2e", message }),
    });
    expect(result.code).toBe(0);
    await recorder.next("api status", statusWithMessage(message));
  });

  test("paths outside /v1 are refused", async () => {
    const result = await exec(["tesseract-controller", "api", "GET", "/v1/../ui/vnc"]);
    expect(result.code).toBe(2);
  });

  test("status --json does not print the token or the VNC password", async () => {
    const result = await exec(["tesseract-controller", "status", "--json"]);
    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain(e2e.token);
    expect(result.stdout).not.toContain(e2e.vncPassword);
  });
});
