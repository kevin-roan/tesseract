import { sampleBuild } from "@tesseract/protocol/fixtures";

import { activeBuilds, buildActivityMessage, buildActivityTitle } from "@/features/home/utils/builds";

const running = { ...sampleBuild, id: "bld_running01", state: "running" as const, stage: "compile", progress: 0.4, endedAt: null };

describe("home build activity", () => {
  it("keeps unfinished builds, newest first", () => {
    const older = { ...running, id: "bld_older0001", createdAt: "2026-01-01T00:00:00.000Z" };
    const queued = { ...running, id: "bld_queued001", state: "queued" as const, createdAt: "2026-12-01T00:00:00.000Z" };
    expect(activeBuilds([sampleBuild, older, queued]).map((build) => build.id)).toEqual([queued.id, older.id]);
  });

  it("titles running and queued builds", () => {
    expect(buildActivityTitle(running)).toBe("Building Windows installer");
    expect(buildActivityTitle({ ...running, state: "queued" })).toBe("Windows installer queued");
  });

  it("describes the project, stage, elapsed time and other builds", () => {
    const now = Date.parse(running.startedAt!) + 90_000;
    expect(buildActivityMessage(running, 0, now)).toBe("electron-hello · Compile · 1m 30s");
    expect(buildActivityMessage({ ...running, stage: null, startedAt: null }, 2, now)).toBe("electron-hello · +2 more builds");
  });
});
