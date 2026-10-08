import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { BuildPhase, SetupChoices } from "../../shared/contracts/sandbox";
import { buildArgs, currentStack, runBuild, savedChoices, writeStack } from "./build";
import { defaultChoices } from "./choices";
import { parseEnvFile } from "./env-file";
import { FakeDocker, failed, ok, readyReport, tempStack, type TempStack } from "./test-support";

let stack: TempStack;
afterEach(() => stack?.cleanup());

const GIB = 1024 ** 3;

function choices(overrides: Partial<SetupChoices> = {}): SetupChoices {
  return {
    ...defaultChoices({ cpus: 8, memBytes: 16 * GIB, timeZone: "UTC", homeDir: stack.dir }, null),
    project: "tesseract-test-build",
    controllerPort: 7811,
    vncPort: 5911,
    hostClaudeDir: join(stack.dir, "claude"),
    ...overrides,
  };
}

function config(): Record<string, unknown> {
  return JSON.parse(readFileSync(stack.context().configFile as string, "utf8")) as Record<string, unknown>;
}

const T = "2026-10-06T19:02:44Z";
const rawjson = [
  JSON.stringify({ vertexes: [{ digest: "a", name: "[sandbox 1/2] FROM base", started: T, completed: T, cached: true }] }),
  JSON.stringify({ vertexes: [{ digest: "b", name: "[sandbox 2/2] RUN true", started: T }] }),
  JSON.stringify({ vertexes: [{ digest: "b", name: "[sandbox 2/2] RUN true", started: T, completed: T }] }),
];

function happyDocker(): FakeDocker {
  return new FakeDocker()
    .onRun((args) => (args[0] === "inspect" ? ok(JSON.stringify({ Status: "running", Health: { Status: "starting" } })) : undefined))
    .onRun((args) => (args[0] === "image" && args[1] === "inspect" ? ok("sha256:img\n") : undefined))
    .onRun((args) => (args[0] === "ps" ? ok("tesseract-test-build-sandbox-1\trunning\tUp 1 second\tsandbox\n") : undefined))
    .onStream((args, options) => {
      if (args[0] !== "buildx") return undefined;
      rawjson.forEach((line) => options.onStderr?.(line));
      return { code: 0 };
    })
    .onStream((args) => (args[0] === "compose" ? { code: 0 } : undefined));
}

describe("writeStack", () => {
  it("writes a 0600 env file with a generated token and persists sandboxStack", async () => {
    stack = tempStack();
    const context = stack.context(new FakeDocker().deps());
    const saved = await writeStack(context, choices({ components: ["android", "whisper"] }));
    const text = readFileSync(context.envFile, "utf8");
    const values = parseEnvFile(text);
    expect(values).toMatchObject({
      TESSERACT_MODE: "local",
      TESSERACT_BIND_ADDR: "127.0.0.1",
      TESSERACT_COMPOSE_PROJECT: "tesseract-test-build",
      WITH_FLUTTER: "false",
      WITH_WHISPER: "true",
      TESSERACT_HOST_CLAUDE_DIR: join(stack.dir, "claude"),
    });
    expect(values.TESSERACT_TOKEN).toMatch(/^[A-Za-z0-9_-]{43}$/);
    if (process.platform !== "win32") {
      expect(statSync(context.envFile).mode & 0o777).toBe(0o600);
      expect(statSync(dirname(context.envFile)).mode & 0o777).toBe(0o700);
      expect(values.DEV_UID).toBe(String(statSync(join(stack.dir, "claude")).uid));
    }
    expect(saved).toEqual({
      envFile: context.envFile,
      project: "tesseract-test-build",
      mode: "local",
      image: "tesseract/sandbox:latest",
      builtAt: null,
      components: ["android", "whisper"],
    });
    expect(config().sandboxStack).toEqual(saved);

    await writeStack(context, choices({ components: ["android", "whisper"], cpus: 2 }));
    expect(parseEnvFile(readFileSync(context.envFile, "utf8")).TESSERACT_TOKEN).toBe(values.TESSERACT_TOKEN);
  });

  it("keeps the saved auth key, hides it from savedChoices and rejects invalid choices", async () => {
    stack = tempStack();
    const context = stack.context(new FakeDocker().deps());
    await writeStack(context, choices({ mode: "tailscale", tailnetDomain: "tail1.ts.net", tsAuthKey: "tskey-auth-secret" }));
    await writeStack(context, choices({ mode: "tailscale", tailnetDomain: "tail1.ts.net", tsAuthKey: "" }));
    expect(parseEnvFile(readFileSync(context.envFile, "utf8")).TS_AUTHKEY).toBe("tskey-auth-secret");
    const restored = await savedChoices(context, choices());
    expect(restored).toMatchObject({ mode: "tailscale", tailnetDomain: "tail1.ts.net", tsAuthKey: "" });
    await expect(writeStack(context, choices({ project: "Bad Name" }))).rejects.toMatchObject({ code: "invalid_argument" });
  });

  it("derives a stack from an env file when config.json has none", async () => {
    stack = tempStack();
    const context = stack.context(new FakeDocker().deps());
    expect(await currentStack(context)).toBeNull();
    mkdirSync(dirname(context.envFile), { recursive: true });
    writeFileSync(context.envFile, "TESSERACT_MODE=local\nTESSERACT_COMPOSE_PROJECT=tesseract-test-x\nWITH_MONO=false\n");
    expect(await currentStack(context)).toMatchObject({ project: "tesseract-test-x", mode: "local", components: ["android", "flutter", "whisper"] });
  });
});

describe("buildArgs", () => {
  it("passes exactly the compose build args, labels and the bundled context", () => {
    const args = buildArgs(
      parseEnvFile("TESSERACT_IMAGE=tesseract/sandbox:latest\nDEV_UID=1001\nWITH_MONO=false\nWHISPER_MODELS=\"base small\"\n"),
      "/ctx",
      "tesseract",
    );
    expect(args.slice(0, 10)).toEqual([
      "buildx",
      "build",
      "--progress=rawjson",
      "--file",
      join("/ctx", "infra", "docker", "sandbox", "Dockerfile"),
      "--target",
      "sandbox",
      "--load",
      "--tag",
      "tesseract/sandbox:latest",
    ]);
    expect(args).toContain("DEV_UID=1001");
    expect(args).toContain("DEV_GID=1000");
    expect(args).toContain("WITH_MONO=false");
    expect(args).toContain("WHISPER_MODELS=base small");
    expect(args).toContain("com.docker.compose.project=tesseract");
    expect(args.at(-1)).toBe("/ctx");
  });
});

describe("runBuild", () => {
  async function prepared(docker: FakeDocker, overrides: Partial<SetupChoices> = {}) {
    stack = tempStack();
    const context = stack.context(docker.deps());
    await writeStack(context, choices(overrides));
    return context;
  }

  it("builds, starts, waits for health, pairs and saves the connection", async () => {
    const docker = happyDocker();
    const context = await prepared(docker);
    const phases: BuildPhase[] = [];
    const logs: string[] = [];
    const result = await runBuild(context, "build", { onPhase: (phase) => phases.push(phase), onLog: (line) => logs.push(line) }, new AbortController().signal);

    expect(result).toEqual({ kind: "done", apiUrl: "http://127.0.0.1:7811", imageId: "sha256:img" });
    expect(phases.map((phase) => phase.kind)).toEqual(expect.arrayContaining(["preflight", "building", "starting", "waiting", "pairing", "done"]));
    const lastBuilding = phases.filter((phase) => phase.kind === "building").at(-1);
    expect(lastBuilding).toMatchObject({ fraction: 1, cachedSteps: 1, doneSteps: 2 });
    expect(logs).toContain("#2 [sandbox 2/2] RUN true");

    const up = docker.streams.find((call) => call.args[0] === "compose");
    expect(up?.args.slice(-2)).toEqual(["up", "--detach"]);
    expect(up?.env?.TESSERACT_COMPOSE_PROJECT).toBe("tesseract-test-build");
    expect(up?.env?.TESSERACT_BIND_ADDR).toBe("127.0.0.1");

    const saved = config();
    const token = parseEnvFile(readFileSync(context.envFile, "utf8")).TESSERACT_TOKEN;
    expect(saved).toMatchObject({ url: "http://127.0.0.1:7811", token, name: "tesseract-sandbox" });
    expect((saved.sandboxStack as { builtAt: string }).builtAt).toBe(new Date(1_000_000).toISOString());
  });

  it("prefers the discovery result for the connection", async () => {
    const docker = happyDocker();
    stack = tempStack();
    const context = stack.context(
      docker.deps({
        discover: async () => ({
          ok: true,
          config: { apiUrl: "http://127.0.0.1:7811", token: "discovered", name: "box", pairingUrl: "https://box.tail.ts.net", source: "docker" },
          message: "Found box at http://127.0.0.1:7811",
          tried: [],
        }),
      }),
    );
    await writeStack(context, choices());
    await runBuild(context, "existing", {}, new AbortController().signal);
    expect(config()).toMatchObject({ token: "discovered", name: "box", pairingUrl: "https://box.tail.ts.net" });
    expect(docker.streams.some((call) => call.args[0] === "buildx")).toBe(false);
  });

  it("fails preflight when Docker is not ready or the disk is too small", async () => {
    const notReady = happyDocker();
    const context = await prepared(notReady);
    const blocked = { ...readyReport(), checks: [{ id: "daemon", status: "error" as const, title: "", detail: "" }] };
    const result = await runBuild({ ...context, deps: notReady.deps({ probeDocker: async () => blocked }) }, "build", {}, new AbortController().signal);
    expect(result).toMatchObject({ kind: "failed", phase: "preflight" });

    const small = await runBuild({ ...context, deps: notReady.deps({ freeBytes: async () => 10e9 }) }, "build", {}, new AbortController().signal);
    expect(small).toMatchObject({ kind: "failed", phase: "preflight", message: "Only 10 GB free on /var/lib/docker; the build needs about 35 GB." });
  });

  it("reports the failing BuildKit step", async () => {
    const docker = new FakeDocker().onStream((_args, options) => {
      options.onStderr?.(JSON.stringify({ vertexes: [{ digest: "x", name: "[base 3/9] RUN apt-get install -y wine", started: T, completed: T, error: "exit code: 100" }] }));
      options.onStderr?.("ERROR: failed to build");
      return { code: 1 };
    });
    const context = await prepared(docker);
    const result = await runBuild(context, "build", {}, new AbortController().signal);
    expect(result).toEqual({ kind: "failed", phase: "build", message: "[base 3/9] RUN apt-get install -y wine: exit code: 100" });
  });

  it("retries with --progress=plain on old buildx", async () => {
    const seen: string[] = [];
    const context = await prepared(
      new FakeDocker()
        .onRun((args) => (args[0] === "inspect" ? ok(JSON.stringify({ Status: "running" })) : args[0] === "image" ? ok("sha256:i") : undefined))
        .onStream((args, options) => {
          if (args[0] !== "buildx") return { code: 0 };
          const progress = args.find((arg) => arg.startsWith("--progress=")) as string;
          seen.push(progress);
          if (progress === "--progress=rawjson") {
            options.onStderr?.('ERROR: invalid progress mode "rawjson"');
            return { code: 1 };
          }
          options.onStderr?.("#3 [sandbox 1/1] RUN true");
          options.onStderr?.("#3 DONE 0.1s");
          return { code: 0 };
        }),
    );
    expect((await runBuild(context, "build", {}, new AbortController().signal)).kind).toBe("done");
    expect(seen).toEqual(["--progress=rawjson", "--progress=plain"]);
  });

  it("fails fast when the container exits and shows its logs", async () => {
    const docker = new FakeDocker()
      .onRun((args) => (args[0] === "inspect" ? ok(JSON.stringify({ Status: "exited", ExitCode: 1 })) : undefined))
      .onRun((args) => (args[0] === "logs" ? ok("boom\n") : undefined))
      .onRun((args) => (args[0] === "image" ? ok("sha256:i") : undefined));
    const context = await prepared(docker);
    const logs: string[] = [];
    const result = await runBuild(
      { ...context, deps: docker.deps({ fetch: async () => new Response("", { status: 503 }) }) },
      "existing",
      { onLog: (line) => logs.push(line) },
      new AbortController().signal,
    );
    expect(result).toEqual({ kind: "failed", phase: "health", message: "The sandbox container exited (1)" });
    expect(logs).toContain("boom");
  });

  it("times out the health wait after 180 s", async () => {
    const docker = new FakeDocker()
      .onRun((args) => (args[0] === "inspect" ? ok(JSON.stringify({ Status: "running" })) : undefined))
      .onRun((args) => (args[0] === "image" ? ok("sha256:i") : undefined));
    const context = await prepared(docker);
    const result = await runBuild(
      { ...context, deps: docker.deps({ fetch: async () => new Response("", { status: 503 }) }) },
      "existing",
      {},
      new AbortController().signal,
    );
    expect(result).toMatchObject({ kind: "failed", phase: "health" });
    expect(docker.clock - 1_000_000).toBeGreaterThanOrEqual(180_000);
  });

  it("resumes at the failed phase and skips the image build", async () => {
    const docker = happyDocker();
    const context = await prepared(docker);
    const result = await runBuild(context, "build", {}, new AbortController().signal, { resumeFrom: "health" });
    expect(result.kind).toBe("done");
    expect(docker.streams).toEqual([]);
  });

  it("returns cancelled when aborted during the build", async () => {
    const controller = new AbortController();
    const docker = new FakeDocker().onStream(() => {
      controller.abort();
      return { code: null, cancelled: true };
    });
    const context = await prepared(docker);
    const logs: string[] = [];
    expect(await runBuild(context, "build", { onLog: (line) => logs.push(line) }, controller.signal)).toEqual({ kind: "cancelled" });
    expect(logs.at(-1)).toBe("Build cancelled; finished steps are cached");
  });

  it("pulls a configured image ref and tags it", async () => {
    const docker = happyDocker()
      .onRun((args) => (args[0] === "context" ? failed() : undefined))
      .onRun((args) => (args[0] === "tag" ? ok() : undefined));
    docker.onStream((args, options) => {
      if (args[0] !== "pull") return undefined;
      options.onStdout?.("aaaaaaaaaaaa: Pull complete");
      return { code: 0 };
    });
    const context = await prepared(docker);
    writeFileSync(context.configFile as string, JSON.stringify({ ...config(), sandboxImageRef: "ghcr.io/tesseract/sandbox:0.1.0" }));
    const result = await runBuild(
      { ...context, deps: docker.deps({ platform: "linux" }), env: { ...context.env, DOCKER_HOST: "tcp://127.0.0.1:1" } },
      "pull",
      {},
      new AbortController().signal,
    );
    expect(result.kind).toBe("done");
    expect(docker.streams.find((call) => call.args[0] === "pull")?.args).toEqual(["pull", "ghcr.io/tesseract/sandbox:0.1.0"]);
    expect(docker.calls.find((call) => call.args[0] === "tag")?.args).toEqual(["tag", "ghcr.io/tesseract/sandbox:0.1.0", "tesseract/sandbox:latest"]);
  });
});
