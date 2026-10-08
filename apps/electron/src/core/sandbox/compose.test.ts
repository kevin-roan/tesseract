import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  composeDown,
  composeLogs,
  composeStatus,
  composeUp,
  findExisting,
  healthFromStatus,
  parseExistingContainer,
  parsePsLines,
  removeAuthKey,
} from "./compose";
import { FakeDocker, ok, tempStack, type TempStack } from "./test-support";

let stack: TempStack;
afterEach(() => stack?.cleanup());

function configured(docker: FakeDocker, text: string) {
  stack = tempStack();
  const context = stack.context(docker.deps());
  mkdirSync(dirname(context.envFile), { recursive: true });
  writeFileSync(context.envFile, text);
  return context;
}

describe("status parsing", () => {
  it("reads docker ps lines and health", () => {
    expect(
      parsePsLines("tesseract-tailscale-1\trunning\tUp 9 hours\ttailscale\ntesseract-sandbox-1\trunning\tUp 45 minutes (healthy)\tsandbox\n"),
    ).toEqual([
      { service: "sandbox", container: "tesseract-sandbox-1", state: "running", health: "healthy" },
      { service: "tailscale", container: "tesseract-tailscale-1", state: "running", health: null },
    ]);
    expect(healthFromStatus("Up 3 seconds (health: starting)")).toBe("starting");
    expect(healthFromStatus("Exited (1) 2 minutes ago")).toBeNull();
  });

  it("queries containers by compose project label, configured or not", async () => {
    const docker = new FakeDocker().onRun((args) => (args[0] === "ps" ? ok("tesseract-sandbox-1\texited\tExited (0)\tsandbox\n") : undefined));
    stack = tempStack();
    const status = await composeStatus(stack.context(docker.deps()));
    expect(status).toEqual({
      configured: false,
      project: "tesseract",
      services: [{ service: "sandbox", container: "tesseract-sandbox-1", state: "exited", health: null }],
    });
    expect(docker.calls[0]?.args).toContain("label=com.docker.compose.project=tesseract");
  });
});

describe("compose commands", () => {
  it("up runs compose up --detach and clears TS_AUTHKEY after a tailscale start", async () => {
    const docker = new FakeDocker();
    const context = configured(docker, "TESSERACT_MODE=tailscale\nTS_TAILNET_DOMAIN=t.ts.net\nTS_AUTHKEY=tskey-auth-x\nCUSTOM=1\n");
    const logs: string[] = [];
    docker.onStream((_args, options) => {
      options.onStderr?.("Container started");
      return { code: 0 };
    });
    await composeUp(context, { onLog: (line) => logs.push(line) });
    expect(docker.streams[0]?.args.slice(-2)).toEqual(["up", "--detach"]);
    expect(logs).toEqual(["Container started"]);
    expect(readFileSync(context.envFile, "utf8")).toBe("TESSERACT_MODE=tailscale\nTS_TAILNET_DOMAIN=t.ts.net\nTS_AUTHKEY=\nCUSTOM=1\n");
  });

  it("up refuses a first tailscale start without an auth key or node volume", async () => {
    const docker = new FakeDocker();
    const context = configured(docker, "TESSERACT_MODE=tailscale\nTS_TAILNET_DOMAIN=t.ts.net\n");
    await expect(composeUp(context)).rejects.toThrow(/TS_AUTHKEY is required/);
    expect(docker.calls.filter((call) => call.args[0] === "volume").map((call) => call.args.join(" "))).toContain("volume inspect tesseract-tailscale");
  });

  it("down passes --volumes only when asked and surfaces compose errors", async () => {
    const docker = new FakeDocker();
    const context = configured(docker, "TESSERACT_MODE=local\nTESSERACT_COMPOSE_PROJECT=tesseract-test-c\n");
    await composeDown(context, true);
    expect(docker.streams[0]?.args.slice(-3)).toEqual(["down", "--remove-orphans", "--volumes"]);
    docker.onStream((_args, options) => {
      options.onStderr?.("Error response from daemon: boom");
      return { code: 1 };
    });
    await expect(composeDown(context, false)).rejects.toMatchObject({ code: "unavailable", message: "Error response from daemon: boom" });
  });

  it("logs uses compose when configured and docker logs otherwise", async () => {
    const docker = new FakeDocker().onRun((args) => (args.includes("logs") ? ok("a\nb\n") : undefined));
    const context = configured(docker, "TESSERACT_MODE=local\n");
    expect(await composeLogs(context, 20)).toEqual(["a", "b"]);
    expect(docker.calls[0]?.args).toEqual(expect.arrayContaining(["compose", "logs", "--no-color", "--tail=20"]));

    const bare = new FakeDocker().onRun((args) => (args[0] === "logs" ? ok("c\n") : undefined));
    stack.cleanup();
    stack = tempStack();
    expect(await composeLogs(stack.context(bare.deps()), 5)).toEqual(["c"]);
    expect(bare.calls[0]?.args).toEqual(["logs", "--tail", "5", "tesseract-sandbox-1"]);
  });
});

describe("existing sandbox", () => {
  it("finds the container and image read-only", async () => {
    stack = tempStack();
    const composeFile = join(stack.dir, "compose.yml");
    writeFileSync(composeFile, "services: {}\n");
    const docker = new FakeDocker()
      .onRun((args) => (args[0] === "ps" ? ok("tesseract-sandbox-1\n") : undefined))
      .onRun((args) =>
        args[0] === "inspect"
          ? ok(
              JSON.stringify([
                {
                  State: { Status: "exited" },
                  Config: {
                    Image: "tesseract/sandbox:latest",
                    Labels: { "com.docker.compose.project.config_files": composeFile, "com.docker.compose.project.working_dir": stack.dir },
                  },
                },
              ]),
            )
          : undefined,
      )
      .onRun((args) =>
        args[0] === "image"
          ? ok(JSON.stringify({ Size: 7_300_000_000, Created: "2026-10-01T00:00:00Z", Config: { Labels: { "org.opencontainers.image.version": "0.1.0" } } }))
          : undefined,
      );
    const existing = await findExisting(stack.context(docker.deps()), "tesseract", "tesseract/sandbox:latest");
    expect(existing).toEqual({
      container: { name: "tesseract-sandbox-1", state: "stopped", image: "tesseract/sandbox:latest", configFiles: [composeFile], workingDir: stack.dir },
      image: { ref: "tesseract/sandbox:latest", sizeBytes: 7_300_000_000, version: "0.1.0", createdAt: "2026-10-01T00:00:00Z" },
    });
    expect(docker.calls.every((call) => ["ps", "inspect", "image"].includes(call.args[0] as string))).toBe(true);
  });

  it("hides config files that no longer exist", () => {
    const parsed = parseExistingContainer("x", {
      State: { Status: "running" },
      Config: { Image: "i", Labels: { "com.docker.compose.project.config_files": "/nope/compose.yml" } },
    });
    expect(parsed).toMatchObject({ state: "running", configFiles: null, workingDir: null });
  });

  it("returns nothing when docker has neither", async () => {
    stack = tempStack();
    expect(await findExisting(stack.context(new FakeDocker().deps()), "tesseract", "tesseract/sandbox:latest")).toEqual({ container: null, image: null });
  });
});

describe("removeAuthKey", () => {
  it("is a no-op without a key", async () => {
    stack = tempStack();
    const file = join(stack.dir, ".env");
    writeFileSync(file, "TS_AUTHKEY=\n");
    await removeAuthKey(file);
    expect(readFileSync(file, "utf8")).toBe("TS_AUTHKEY=\n");
  });
});
