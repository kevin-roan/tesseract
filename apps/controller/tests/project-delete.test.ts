import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DeletedProjectSchema } from "@tesseract/protocol";
import { makeTempDir, removeTempDirs, startTestController, TEST_TOKEN, writeFiles, type TestController } from "./helpers";

let t: TestController;
let projects: string;

async function push(id: string, files: Record<string, string>): Promise<string> {
  const source = makeTempDir(`delete-${id}`);
  writeFiles(source, files);
  const archive = Bun.spawnSync(["tar", "-c", "-z", "-f", "-", "-C", source, "."], { stdout: "pipe" }).stdout;
  const response = await fetch(`${t.baseUrl}/v1/projects/${id}/sync`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TEST_TOKEN}`, "Content-Type": "application/gzip" },
    body: archive,
  });
  expect(response.status).toBeLessThan(300);
  return source;
}

beforeAll(async () => {
  const workspace = makeTempDir("project-delete");
  projects = join(workspace, "projects");
  t = await startTestController({ workspace });
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

describe("DELETE /v1/projects/:id", () => {
  test("moves a synced project to the trash directory and leaves the host copy alone", async () => {
    const source = await push("clean", { "a.txt": "a\n" });
    const { status, body } = await t.json("DELETE", "/v1/projects/clean");
    expect(status, JSON.stringify(body)).toBe(200);
    const deleted = DeletedProjectSchema.parse(body);
    expect(deleted.id).toBe("clean");
    expect(deleted.trashPath.startsWith(`${t.config.trashDir}/clean-`)).toBe(true);
    expect(readFileSync(join(deleted.trashPath, "a.txt"), "utf8")).toBe("a\n");
    expect(existsSync(join(projects, "clean"))).toBe(false);
    expect(existsSync(join(t.config.dataDir, "sync", "clean.json"))).toBe(false);
    expect(readFileSync(join(source, "a.txt"), "utf8")).toBe("a\n");
    expect((await t.json("GET", "/v1/projects/clean")).status).toBe(404);
  });

  test("refuses unsynced changes without force, then moves them with force", async () => {
    await push("dirty", { "a.txt": "a\n" });
    writeFiles(projects, { "dirty/a.txt": "edited\n", "dirty/b.txt": "new\n" });
    const refused = await t.json<{ error: { code: string; message: string } }>("DELETE", "/v1/projects/dirty");
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toContain("2 changes not synced back");
    expect(existsSync(join(projects, "dirty", "b.txt"))).toBe(true);

    const { status, body } = await t.json("DELETE", "/v1/projects/dirty?force=1");
    expect(status).toBe(200);
    expect(readFileSync(join(DeletedProjectSchema.parse(body).trashPath, "b.txt"), "utf8")).toBe("new\n");
    expect(existsSync(join(projects, "dirty"))).toBe(false);
  });

  test("a project that never came from a host needs force", async () => {
    expect((await t.json("POST", "/v1/projects", { name: "local only" })).status).toBe(201);
    const refused = await t.json<{ error: { message: string } }>("DELETE", "/v1/projects/local-only");
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toContain("never synced from a host");
    expect((await t.json("DELETE", "/v1/projects/local-only?force=true")).status).toBe(200);
  });

  test("refuses while a sync request is pending, and 404s an unknown project", async () => {
    await push("busy", { "a.txt": "a\n" });
    expect((await t.json("POST", "/v1/projects/busy/sync/requests", { kind: "pull" })).status).toBe(201);
    expect((await t.json("DELETE", "/v1/projects/busy?force=1")).status).toBe(409);
    expect(existsSync(join(projects, "busy"))).toBe(true);
    expect((await t.json("DELETE", "/v1/projects/missing")).status).toBe(404);
  });
});
