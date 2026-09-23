import { resolve } from "node:path";
import { e2e, REPO_ROOT } from "./env";

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface ExecOptions {
  user?: string;
  cwd?: string;
  stdin?: string | Uint8Array;
  env?: Record<string, string>;
}

const SANDBOX_CLI = resolve(REPO_ROOT, "infra/scripts/sandbox");

async function run(argv: string[], stdin?: string | Uint8Array | Blob): Promise<ExecResult> {
  const child = Bun.spawn(argv, {
    stdin: stdin === undefined ? "ignore" : typeof stdin === "string" ? new TextEncoder().encode(stdin) : stdin,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { code, stdout, stderr };
}

function describe(argv: string[], result: ExecResult): string {
  return `${argv.join(" ")} exited ${result.code}\n--- stdout\n${result.stdout}\n--- stderr\n${result.stderr}`;
}

export async function containerId(): Promise<string> {
  const result = await run([
    "docker",
    "ps",
    "-q",
    "--filter",
    `label=com.docker.compose.project=${e2e.project}`,
    "--filter",
    "label=com.docker.compose.service=sandbox",
  ]);
  const id = result.stdout.trim().split("\n")[0];
  if (result.code !== 0 || !id) throw new Error(`sandbox container of ${e2e.project} not found\n${result.stderr}`);
  return id;
}

export async function exec(command: string[], options: ExecOptions = {}): Promise<ExecResult> {
  const id = await containerId();
  const flags = ["-u", options.user ?? "dev", "-w", options.cwd ?? "/workspace"];
  if (options.stdin !== undefined) flags.push("-i");
  for (const [key, value] of Object.entries(options.env ?? {})) flags.push("-e", `${key}=${value}`);
  return run(["docker", "exec", ...flags, id, ...command], options.stdin);
}

export async function execOk(command: string[], options: ExecOptions = {}): Promise<string> {
  const result = await exec(command, options);
  if (result.code !== 0) throw new Error(describe(command, result));
  return result.stdout;
}

export function sh(script: string, options: ExecOptions = {}): Promise<string> {
  return execOk(["bash", "-lc", script], options);
}

export async function copyDirectory(hostDir: string, containerParent: string): Promise<void> {
  const parent = resolve(hostDir, "..");
  const name = hostDir.split("/").filter(Boolean).pop() ?? "";
  const tar = Bun.spawn(["tar", "-C", parent, "--exclude=node_modules", "--exclude=dist", "-cf", "-", name], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [archive, stderr, code] = await Promise.all([
    new Response(tar.stdout).bytes(),
    new Response(tar.stderr).text(),
    tar.exited,
  ]);
  if (code !== 0) throw new Error(`tar of ${hostDir} failed: ${stderr}`);
  await execOk(["tar", "-C", containerParent, "-xf", "-"], { stdin: archive });
}

export async function sandboxCli(args: string[]): Promise<ExecResult> {
  const argv = [SANDBOX_CLI, "--env-file", e2e.envFile, "--mode", "local", ...args];
  const result = await run(argv);
  if (result.code !== 0) throw new Error(describe(argv, result));
  return result;
}

export async function processesMatching(pattern: string): Promise<string[]> {
  const result = await exec(["pgrep", "-af", pattern]);
  if (result.code === 1) return [];
  if (result.code !== 0) throw new Error(describe(["pgrep", "-af", pattern], result));
  return result.stdout.split("\n").filter(Boolean);
}
