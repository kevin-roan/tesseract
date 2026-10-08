import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ConnectionInput, DiscoveryResult } from "../../shared/contracts/connection";
import type { BuildPhase } from "../../shared/contracts/sandbox";
import { adoptExisting } from "./adopt";
import { FakeDocker, ok, tempStack, type TempStack } from "./test-support";

const TARGET = { project: "tesseract-test-adopt", image: "tesseract/sandbox:latest" };
const CONTAINER = "tesseract-test-adopt-sandbox-1";
const FOUND: DiscoveryResult & { ok: true } = {
  ok: true,
  config: { apiUrl: "http://127.0.0.1:7700", token: "t".repeat(43), name: "box", pairingUrl: "http://127.0.0.1:7700", source: "docker", container: CONTAINER },
  message: "Found box at http://127.0.0.1:7700",
  tried: [],
};

let stack: TempStack;
afterEach(() => stack?.cleanup());

function inspect(state: "running" | "exited", files: string[] | null) {
  const labels: Record<string, string> = files ? { "com.docker.compose.project.config_files": files.join(","), "com.docker.compose.project.working_dir": stack.dir } : {};
  return JSON.stringify([{ State: { Status: state }, Config: { Image: TARGET.image, Labels: labels } }]);
}

function docker(state: "running" | "exited" | null, files: string[] | null = null): FakeDocker {
  return new FakeDocker().onRun((args) => {
    if (args[0] === "ps") return ok(state ? `${CONTAINER}\n` : "");
    if (args[0] === "inspect") return ok(inspect(state ?? "running", files));
    if (args[0] === "image" && args.includes("{{.Id}}")) return ok("sha256:abc\n");
    if (args[0] === "image") return ok(JSON.stringify({ Size: 1, Created: "2026-10-01T00:00:00Z" }));
    return undefined;
  });
}

async function adopt(fake: FakeDocker, discover: () => Promise<DiscoveryResult> = async () => FOUND) {
  stack = tempStack();
  const saved: ConnectionInput[] = [];
  const phases: BuildPhase[] = [];
  const context = { ...stack.context(fake.deps({ discover })), saveConnection: async (input: ConnectionInput) => void saved.push(input) };
  const result = await adoptExisting(context, TARGET, { onPhase: (phase) => phases.push(phase) }, new AbortController().signal);
  return { result, saved, phases };
}

describe("adoptExisting", () => {
  it("pairs with a running sandbox without starting it", async () => {
    const fake = docker("running");
    const { result, saved, phases } = await adopt(fake);
    expect(result).toEqual({ kind: "done", apiUrl: FOUND.config.apiUrl, imageId: "sha256:abc" });
    expect(saved).toEqual([{ apiUrl: FOUND.config.apiUrl, token: FOUND.config.token, name: "box", pairingUrl: FOUND.config.pairingUrl }]);
    expect(fake.streams).toEqual([]);
    expect(phases.map((phase) => phase.kind)).toEqual(["preflight", "waiting", "pairing", "done"]);
  });

  it("starts a stopped sandbox with its own compose files", async () => {
    stack = tempStack();
    const file = join(stack.dir, "compose.yml");
    mkdirSync(stack.dir, { recursive: true });
    writeFileSync(file, "services: {}\n");
    const fake = docker("exited", [file]);
    const saved: ConnectionInput[] = [];
    const context = { ...stack.context(fake.deps({ discover: async () => FOUND })), saveConnection: async (input: ConnectionInput) => void saved.push(input) };
    const result = await adoptExisting(context, TARGET, {}, new AbortController().signal);
    expect(result.kind).toBe("done");
    expect(fake.streams[0]?.args).toEqual(["compose", "--project-name", TARGET.project, "--project-directory", stack.dir, "-f", file, "up", "--detach"]);
  });

  it("fails when a stopped sandbox lost its compose files", async () => {
    const { result } = await adopt(docker("exited", null));
    expect(result).toMatchObject({ kind: "failed", phase: "up" });
  });

  it("fails when the container is gone", async () => {
    const { result } = await adopt(docker(null));
    expect(result).toMatchObject({ kind: "failed", phase: "preflight" });
  });

  it("retries discovery until the controller answers, then gives up", async () => {
    let calls = 0;
    const { result } = await adopt(docker("running"), async () => {
      calls += 1;
      return { ok: false as const, error: "not yet" };
    });
    expect(result).toEqual({ kind: "failed", phase: "pair", message: "not yet" });
    expect(calls).toBeGreaterThan(1);
  });
});
