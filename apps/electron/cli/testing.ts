import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COMPOSE_DIR } from "../src/core/sandbox/constants";
import { ENV } from "../src/shared/runtime";
import { CLI_ENV } from "./constants";
import { main } from "./index";
import { createRuntime, type CliRuntime } from "./runtime";
import type { CliContext, CliIo } from "./types";

export interface Captured {
  io: CliIo;
  out: string[];
  err: string[];
}

export function capture(): Captured {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { stdout: (line) => void out.push(line), stderr: (line) => void err.push(line) }, out, err };
}

export interface Sandbox {
  root: string;
  home: string;
  configFile: string;
  contextDir: string;
  env: NodeJS.ProcessEnv;
  runtime: CliRuntime;
  cleanup(): void;
}

export function tempSandbox(extraEnv: NodeJS.ProcessEnv = {}): Sandbox {
  const root = mkdtempSync(join(tmpdir(), "tesseract-test-cli-"));
  const home = join(root, "home");
  const contextDir = join(root, "context");
  mkdirSync(join(contextDir, ...COMPOSE_DIR), { recursive: true });
  mkdirSync(home, { recursive: true });
  const configFile = join(root, "config", "config.json");
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    [ENV.config]: configFile,
    [ENV.userData]: join(root, "user-data"),
    [ENV.stateDir]: join(root, "state"),
    [CLI_ENV.sandboxContext]: contextDir,
    ANDROID_AVD_HOME: join(root, "avd"),
    ...extraEnv,
  };
  const runtime = createRuntime({
    env,
    platform: "linux",
    arch: "x64",
    home,
    execPath: join(root, "node"),
    moduleDir: root,
    cwd: root,
  });
  return { root, home, configFile, contextDir, env, runtime, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

export async function runCli(sandbox: Sandbox, argv: string[], signal?: AbortSignal): Promise<Captured & { code: number }> {
  const captured = capture();
  const code = await main(argv, { io: captured.io, runtime: sandbox.runtime, env: sandbox.env, cwd: sandbox.root, signal });
  return { ...captured, code };
}

export function testContext(sandbox: Sandbox, overrides: Partial<CliContext> = {}): CliContext & Captured {
  const captured = capture();
  return {
    argv: [],
    args: [],
    flags: new Set(),
    values: new Map(),
    json: false,
    verbose: false,
    cwd: sandbox.root,
    env: sandbox.env,
    runtime: sandbox.runtime,
    signal: new AbortController().signal,
    ...captured,
    ...overrides,
  };
}
