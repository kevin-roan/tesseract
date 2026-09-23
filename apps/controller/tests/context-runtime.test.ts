import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { AgentContextSchema, ProcessInfoSchema } from "@theone/protocol";
import { makeTempDir, removeTempDirs, startTestController, waitFor, writeFiles, type TestController } from "./helpers";

let t: TestController;
let workspace: string;

beforeAll(async () => {
  workspace = makeTempDir("context");
  const outside = makeTempDir("outside");
  writeFiles(outside, { "SECRET.md": "do not read\n" });
  writeFiles(workspace, {
    "projects/app/.keep": "",
    ".agent/CURRENT_TASK.md": "# Current Task\nProject: app\n",
    ".agent/GLOBAL_CONTEXT.md": "# Global\n",
    ".agent/notes.txt": "not markdown\n",
    ".agent/BIG.md": `${"é".repeat(40_000)}\n`,
    ".agent/projects/app/PROJECT_STATE.md": "# App\n",
    ".agent/projects/app/logs/deep.md": "too deep\n",
    ".agent/logs/agent.md": "scratch\n",
  });
  symlinkSync(join(outside, "SECRET.md"), join(workspace, ".agent", "LINK.md"));
  symlinkSync(outside, join(workspace, ".agent", "projects", "linked"));
  t = await startTestController({ workspace });
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

describe("GET /v1/context", () => {
  test("returns top-level and per-project markdown without following symlinks", async () => {
    await t.controller.services.runtime.flush();
    const { status, body } = await t.json("GET", "/v1/context");
    expect(status).toBe(200);
    const context = AgentContextSchema.parse(body);
    const names = context.files.map((file) => file.name);
    expect(names).toEqual(["BIG.md", "CURRENT_TASK.md", "GLOBAL_CONTEXT.md", "RUNTIME.md", "projects/app/PROJECT_STATE.md"]);
    const current = context.files.find((file) => file.name === "CURRENT_TASK.md");
    expect(current).toMatchObject({ truncated: false, content: "# Current Task\nProject: app\n", sizeBytes: 28 });
    expect(current?.path).toBe(join(workspace, ".agent", "CURRENT_TASK.md"));
    const big = context.files.find((file) => file.name === "BIG.md");
    expect(big?.truncated).toBe(true);
    expect(big?.sizeBytes).toBe(80_001);
    expect(Buffer.byteLength(big?.content ?? "")).toBeLessThanOrEqual(64 * 1024);
    expect(big?.content.endsWith("é")).toBe(true);
  });
});

describe("RUNTIME.md", () => {
  test("mirrors running processes atomically", async () => {
    const runtime = join(workspace, ".agent", "RUNTIME.md");
    const { body } = await t.json("POST", "/v1/processes", { projectId: "app", command: "sleep 30", name: "sleeper", port: 45_321 });
    const info = ProcessInfoSchema.parse(body);
    const content = await waitFor(() => {
      const text = existsSync(runtime) ? readFileSync(runtime, "utf8") : "";
      return text.includes(info.id) ? text : null;
    });
    expect(content).toContain("## Running processes (1)");
    expect(content).toContain("| sleeper |");
    expect(content).toContain("45321");
    expect(content).toContain("X display :987: not available");
    expect(content).not.toContain(t.controller.services.token);

    await t.json("DELETE", `/v1/processes/${info.id}`);
    const after = await waitFor(() => {
      const text = readFileSync(runtime, "utf8");
      return text.includes("## Running processes (0)") ? text : null;
    });
    expect(after).toContain("## Recently ended processes");
    expect(after).toMatch(new RegExp(`\\| ${info.id} \\| app \\| sleeper \\| stopped \\|`));
    expect(readdirSync(join(workspace, ".agent")).some((name) => name.endsWith(".tmp"))).toBe(false);
  });
});
