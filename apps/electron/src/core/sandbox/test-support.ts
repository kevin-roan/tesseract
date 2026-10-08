import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DockerReport } from "../../shared/contracts/docker";
import type { CommandResult } from "../process";
import type { StreamOptions, StreamResult } from "./spawn";
import type { SandboxContext, SandboxDeps } from "./types";

export interface RecordedCall {
  file: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}

export type RunHandler = (args: string[], file: string) => Partial<CommandResult> | undefined;
export type StreamHandler = (args: string[], options: StreamOptions) => Partial<StreamResult> | Promise<Partial<StreamResult>> | undefined;

export function ok(stdout = ""): Partial<CommandResult> {
  return { code: 0, stdout };
}

export function failed(stderr = "error", code = 1): Partial<CommandResult> {
  return { code, stderr };
}

export function readyReport(overrides: Partial<DockerReport> = {}): DockerReport {
  return {
    cli: { path: "/usr/bin/docker", version: "29.0.0" },
    daemon: "reachable",
    daemonError: null,
    kind: "engine",
    context: "default",
    server: { version: "29.0.0", os: "linux", arch: "x86_64", ncpu: 8, memBytes: 16 * 1024 ** 3, rootDir: "/var/lib/docker", rootless: false },
    compose: "2.30.0",
    buildx: "0.20.0",
    checks: ["cli", "daemon", "compose", "buildx", "resources"].map((id) => ({ id, status: "ok" as const, title: id, detail: "" })),
    ...overrides,
  };
}

export class FakeDocker {
  readonly calls: RecordedCall[] = [];
  readonly streams: RecordedCall[] = [];
  private readonly runHandlers: RunHandler[] = [];
  private readonly streamHandlers: StreamHandler[] = [];
  clock = 1_000_000;

  onRun(handler: RunHandler): this {
    this.runHandlers.push(handler);
    return this;
  }

  onStream(handler: StreamHandler): this {
    this.streamHandlers.push(handler);
    return this;
  }

  deps(overrides: Partial<SandboxDeps> = {}): Partial<SandboxDeps> {
    return {
      run: async (file, args, options) => {
        this.calls.push({ file, args: [...args], env: options?.env });
        for (const handler of this.runHandlers) {
          const result = handler([...args], file);
          if (result) return { code: 0, stdout: "", stderr: "", timedOut: false, ...result };
        }
        if (args[0] === "ps") return { code: 0, stdout: "", stderr: "", timedOut: false };
        return { code: 1, stdout: "", stderr: "unexpected", timedOut: false };
      },
      stream: async (file, args, options = {}) => {
        this.streams.push({ file, args: [...args], env: options.env });
        for (const handler of this.streamHandlers) {
          const result = await handler([...args], options);
          if (result) return { code: 0, cancelled: false, error: null, ...result };
        }
        return { code: 0, cancelled: false, error: null };
      },
      fetch: async () => new Response(JSON.stringify({ ok: true, protocolVersion: 1 }), { status: 200 }),
      probeDocker: async () => readyReport(),
      discover: async () => ({ ok: false, error: "discovery unavailable" }),
      freeBytes: async () => 500e9,
      platform: "linux",
      homeDir: "/home/test",
      processIds: () => ({ uid: 1234, gid: 1234 }),
      now: () => this.clock,
      sleep: async (ms) => {
        this.clock += ms;
      },
      ...overrides,
    };
  }
}

export interface TempStack {
  dir: string;
  context: (deps?: Partial<SandboxDeps>, env?: NodeJS.ProcessEnv) => SandboxContext;
  cleanup(): void;
}

export function tempStack(): TempStack {
  const dir = mkdtempSync(join(tmpdir(), "tesseract-test-sandbox-"));
  const contextDir = join(dir, "ctx");
  mkdirSync(join(contextDir, "infra", "compose"), { recursive: true });
  mkdirSync(join(dir, "claude"), { recursive: true });
  return {
    dir,
    context: (deps = {}, env = { PATH: "/usr/bin", HOME: join(dir, "home") }) => ({
      contextDir,
      envFile: join(dir, "user", "sandbox", ".env"),
      env,
      configFile: join(dir, "config", "config.json"),
      deps,
    }),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
