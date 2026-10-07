import { lstat, rm, unlink } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { buildManifest, hashPath, resolvePath } from "./manifest";
import { pull } from "./pull";
import { SyncState, newLink } from "./state";
import { FakeController, PROJECT, tempDir, tree, walk, write } from "./testing";

const failure = vi.hoisted(() => ({ calls: 0, failOn: 0 }));

vi.mock("./fsutil", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./fsutil")>();
  return {
    ...actual,
    install: async (source: string, target: string, mode?: number) => {
      failure.calls += 1;
      if (failure.calls === failure.failOn) throw new Error("disk full");
      return actual.install(source, target, mode);
    },
  };
});

let tmp: string;

beforeEach(async () => {
  tmp = await resolvePath(await tempDir("rollback"));
  failure.calls = 0;
  failure.failOn = 3;
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

it("rolls back when a write fails half way", async () => {
  const host = join(tmp, "host", PROJECT);
  const sandbox = join(tmp, "sandbox");
  for (const root of [host, sandbox]) {
    await write(root, "README.md", "hello\n");
    await write(root, "src/app.py", "print('v1')\n");
    await write(root, "src/old.py", "old\n");
  }
  const state = new SyncState(join(tmp, "state"));
  await state.saveLink(newLink({ projectId: PROJECT, hostPath: host, pushedAt: "x", manifest: await buildManifest(host, await walk(host)) }));
  const controller = new FakeController(sandbox);
  await controller.push();
  await write(sandbox, "a.txt", "a\n");
  await write(sandbox, "b/c.txt", "c\n");
  await write(sandbox, "src/app.py", "print('v2')\n");
  await unlink(join(sandbox, "src/old.py"));
  const before = await tree(host);
  await expect(pull(controller, state, PROJECT)).rejects.toThrow(/nothing was changed: disk full/);
  failure.failOn = 0;
  expect(await tree(host)).toEqual(before);
  expect(await lstat(join(host, "b")).then(() => true, () => false)).toBe(false);
  expect(await state.snapshots(PROJECT)).toEqual([]);
  expect(controller.acks).toEqual([]);
  expect((await state.link(PROJECT))?.manifest["src/app.py"]).toBe(await hashPath(join(host, "src/app.py")));
});
