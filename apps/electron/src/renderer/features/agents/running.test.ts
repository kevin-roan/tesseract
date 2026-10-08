import type { BuildJob, ProcessInfo } from "@tesseract/protocol";
import { describe, expect, it } from "vitest";
import { runningCount, runningWork } from "./running";

const process = (id: string, projectId: string, state: ProcessInfo["state"], startedAt: string) =>
  ({ id, projectId, state, startedAt, name: id, command: "bun run build" }) as ProcessInfo;
const build = (id: string, projectId: string, state: BuildJob["state"], createdAt: string) =>
  ({ id, projectId, state, createdAt, startedAt: null }) as unknown as BuildJob;

describe("runningWork", () => {
  it("keeps the project's live processes and unfinished builds, newest first", () => {
    const work = runningWork(
      "p1",
      [
        process("old", "p1", "running", "2026-10-08T10:00:00Z"),
        process("new", "p1", "starting", "2026-10-08T11:00:00Z"),
        process("done", "p1", "exited", "2026-10-08T12:00:00Z"),
        process("other", "p2", "running", "2026-10-08T12:00:00Z"),
      ],
      [build("b1", "p1", "running", "2026-10-08T10:00:00Z"), build("b2", "p1", "succeeded", "2026-10-08T10:00:00Z")],
    );
    expect(work.processes.map((item) => item.id)).toEqual(["new", "old"]);
    expect(work.builds.map((item) => item.id)).toEqual(["b1"]);
    expect(runningCount(work)).toBe(3);
  });

  it("shows nothing without a project", () => {
    expect(runningCount(runningWork(null, [process("a", "p1", "running", "2026-10-08T10:00:00Z")], []))).toBe(0);
  });
});
