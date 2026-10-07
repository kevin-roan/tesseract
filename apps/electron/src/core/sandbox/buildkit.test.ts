import { describe, expect, it } from "vitest";
import { BuildProgress, parseStepName, stepWeight } from "./buildkit";
import { weightsFromDockerfile } from "./weights";

const T = "2026-10-06T19:02:44.13204837Z";
const vertex = (digest: string, name: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ vertexes: [{ digest, name, ...extra }] });
const log = (digest: string, text: string) =>
  JSON.stringify({ logs: [{ vertex: digest, stream: 1, data: Buffer.from(text).toString("base64"), timestamp: T }] });

describe("parseStepName", () => {
  it("parses BuildKit step names and ignores internal vertexes", () => {
    expect(parseStepName("[android 2/2] COPY --from=android-sdk /opt/android /opt/android")).toEqual({
      stage: "android",
      index: 2,
      count: 2,
      cmd: "COPY --from=android-sdk /opt/android /opt/android",
    });
    expect(parseStepName("[internal] load build definition from Dockerfile")).toBeNull();
    expect(parseStepName("[auth] library/debian:pull token for registry-1.docker.io")).toBeNull();
  });

  it("weights heavy RUN steps", () => {
    expect(stepWeight("RUN --mount=type=cache,target=/var/cache/apt apt-get install -y wine")).toBe(10);
    expect(stepWeight("COPY wine.txt /x")).toBe(1);
  });
});

describe("BuildProgress (rawjson)", () => {
  it("tracks steps, logs, cache and fraction from real-shaped messages", () => {
    const progress = new BuildProgress(null);
    expect(progress.pushRaw(vertex("sha256:i", "[internal] load build definition from Dockerfile", { started: T }))).toEqual([
      "#1 [internal] load build definition from Dockerfile",
    ]);
    expect(progress.snapshot().fraction).toBeNull();

    progress.pushRaw(vertex("sha256:a", "[base 1/2] FROM docker.io/library/redis:7-alpine", { started: T, completed: T, cached: true }));
    progress.pushRaw(vertex("sha256:b", "[base 2/2] RUN echo building-step && echo line2", { started: T }));
    expect(progress.pushRaw(log("sha256:b", "building-step\nline"))).toEqual(["#3 building-step"]);
    expect(progress.pushRaw(log("sha256:b", "2\n"))).toEqual(["#3 line2"]);
    progress.pushRaw(JSON.stringify({ statuses: [{ id: "x", vertex: "sha256:b", current: 50, total: 200, timestamp: T }] }));

    const running = progress.snapshot();
    expect(running).toMatchObject({ step: "RUN echo building-step && echo line2", cachedSteps: 1, doneSteps: 1, totalSteps: 2 });
    expect(running.bytes).toEqual({ current: 50, total: 200 });
    expect(running.fraction).toBeCloseTo(0.5);

    progress.pushRaw(vertex("sha256:b", "[base 2/2] RUN echo building-step && echo line2", { started: T, completed: T }));
    expect(progress.snapshot().fraction).toBe(1);
    expect(progress.failure()).toBeNull();
    expect(progress.allCached()).toBe(false);
  });

  it("estimates unseen stages from the weights file and never goes backwards", () => {
    const progress = new BuildProgress({ base: [1, 1, 1, 1], sandbox: [1, 10] });
    progress.pushRaw(vertex("sha256:a", "[base 1/4] FROM debian", { started: T, completed: T }));
    const first = progress.snapshot();
    expect(first.fraction).toBeCloseTo(1 / 15);
    expect(first.totalSteps).toBe(6);
    progress.pushRaw(vertex("sha256:z", "[sandbox 1/9] FROM base", {}));
    expect(progress.snapshot().fraction).toBeGreaterThanOrEqual(first.fraction as number);
  });

  it("reports the first failing vertex with its last log lines", () => {
    const progress = new BuildProgress(null);
    progress.pushRaw(vertex("sha256:c", "[final 2/2] RUN echo fail >&2 && exit 3", { started: T }));
    progress.pushRaw(log("sha256:c", "fail\n"));
    const lines = progress.pushRaw(
      vertex("sha256:c", "[final 2/2] RUN echo fail >&2 && exit 3", { started: T, completed: T, error: "exit code: 3" }),
    );
    expect(lines).toEqual(["#1 ERROR: exit code: 3"]);
    expect(progress.failure()).toEqual({
      message: "[final 2/2] RUN echo fail >&2 && exit 3: exit code: 3",
      logs: ["#1 fail"],
    });
  });

  it("passes non-JSON lines through and detects a fully cached build", () => {
    const progress = new BuildProgress(null);
    expect(progress.pushRaw("ERROR: failed to build")).toEqual(["ERROR: failed to build"]);
    progress.pushRaw(vertex("sha256:a", "[base 1/2] FROM debian", { started: T, completed: T }));
    progress.pushRaw(vertex("sha256:b", "[base 2/2] RUN apt-get install -y x", { started: T, completed: T, cached: true }));
    expect(progress.allCached()).toBe(true);
  });
});

describe("BuildProgress (plain fallback)", () => {
  it("uses #n step, CACHED, DONE and ERROR lines", () => {
    const progress = new BuildProgress(null);
    for (const line of [
      "#1 [internal] load build definition from Dockerfile",
      "#1 DONE 0.0s",
      "#5 [base 1/2] FROM docker.io/library/debian",
      "#5 CACHED",
      "#6 [base 2/2] RUN make",
      "#6 0.393 compiling",
    ]) {
      progress.pushPlain(line);
    }
    expect(progress.snapshot()).toMatchObject({ step: "RUN make", cachedSteps: 1, doneSteps: 1, totalSteps: 2 });
    progress.pushPlain("#6 ERROR: process did not complete successfully: exit code: 2");
    expect(progress.failure()).toEqual({
      message: "[base 2/2] RUN make: process did not complete successfully: exit code: 2",
      logs: ["#3 compiling"],
    });
  });
});

describe("weightsFromDockerfile", () => {
  it("counts vertex-producing instructions per stage", () => {
    const dockerfile = [
      "ARG DEBIAN_IMAGE=debian",
      "FROM ${DEBIAN_IMAGE} AS base",
      "ARG X=1",
      "ENV Y=2",
      "RUN apt-get update \\",
      " && apt-get install -y curl",
      "COPY a /a",
      "FROM base AS sandbox",
      "WORKDIR /w",
    ].join("\n");
    expect(weightsFromDockerfile(dockerfile)).toEqual({ base: [1, 10, 1], sandbox: [1, 1] });
  });
});
