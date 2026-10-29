import { lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { renderANSI } from "uqr";
import { buildPairingLink, HOST_WORKSPACE_PORT, isValidProjectId, projectIdFromName, type HostWorkspaceAccess } from "@tesseract/protocol";
import { resolveToken } from "../auth/token";
import { CliError } from "../cli/local-api";
import { ConfigError, ensureDirectories, loadConfig, localApiUrl, type Config } from "../config";
import type { Env } from "../core/exec";
import { isInside } from "../core/paths";
import { startController } from "../server";
import { HostConfigError, tailscaleIpv4, tailscaleServeUrl, validateBind, validatePort } from "./config";
import type { HostCliIo } from "./cli";
import { savedToolchainEnv } from "./toolchain";

export const HOST_WORKSPACE_USAGE = `  tesseract-controller host workspace serve [--bind <ipv4>] [--port <n>]
                                     run the host workspace controller (on the host, no sandbox) on the host's
                                     Tailscale IPv4 (or loopback), port ${HOST_WORKSPACE_PORT}; its projects are links to host
                                     repositories and Claude edits them in place (TESSERACT_HOST_WORKSPACE,
                                     TESSERACT_HOST_WORKSPACE_BIND, TESSERACT_HOST_WORKSPACE_PORT, TESSERACT_HOST_WORKSPACE_PUBLIC_URL)
  tesseract-controller host workspace add [<path>] [--name <name> | --id <id>] [--json]
                                     link a host repository (default: the current directory) into the host workspace;
                                     --id links it as exactly <id>, replacing a link with that id (the desktop app links
                                     each synced project's host copy under the sandbox project's id);
                                     --json prints { id, path, created }
  tesseract-controller host workspace stop [--json]
                                     stop the running host workspace controller (pid file in its data dir);
                                     --json prints { stopped }
  tesseract-controller host workspace pair [--json]
                                     print the pairing link (tesseract://pair) of the host workspace controller;
                                     --json prints { link, url, localUrl, name }`;

/** Controller env that is only meant for the sandbox controller (or the CLI talking to it). */
const SANDBOX_ONLY_ENV = ["TESSERACT_TOKEN", "TESSERACT_TOKEN_FILE", "TESSERACT_DATA_DIR", "TESSERACT_HOST", "TESSERACT_PORT", "TESSERACT_PUBLIC_URL"];
const MAX_ID_SUFFIX = 99;

type Overrides = { bind?: string; port?: string };

const dataBase = (env: Env) => env.XDG_DATA_HOME || join(env.HOME || homedir(), ".local", "share");

export function hostWorkspaceDir(env: Env): string {
  return env.TESSERACT_HOST_WORKSPACE || join(dataBase(env), "tesseract", "host-workspace");
}

function bindAddress(env: Env, requested: string | undefined, resolveBind: boolean): string {
  if (requested !== undefined) {
    if (!requested.trim() || requested.trim() === "::") throw new HostConfigError("Refusing to listen on every interface; bind the host's Tailscale IPv4");
    return validateBind(requested);
  }
  return resolveBind ? validateBind(tailscaleIpv4(env)) : "127.0.0.1";
}

/** The controller config of the host workspace: `host` runtime, bound like the host shell daemon (Tailscale or loopback only). */
export function loadHostWorkspaceConfig(env: Env, overrides: Overrides = {}, resolveBind = true): Config {
  try {
    const port = validatePort(overrides.port ?? env.TESSERACT_HOST_WORKSPACE_PORT ?? String(HOST_WORKSPACE_PORT));
    const bind = bindAddress(env, overrides.bind ?? env.TESSERACT_HOST_WORKSPACE_BIND, resolveBind);
    const base: Env = Object.fromEntries(Object.entries(env).filter(([name]) => !SANDBOX_ONLY_ENV.includes(name)));
    return loadConfig({
      ...base,
      TESSERACT_RUNTIME: "host",
      TESSERACT_WORKSPACE: hostWorkspaceDir(env),
      TESSERACT_HOST: bind,
      TESSERACT_PORT: String(port),
      TESSERACT_PUBLIC_URL: env.TESSERACT_HOST_WORKSPACE_PUBLIC_URL || `http://${bind}:${port}`,
      TESSERACT_SANDBOX_ID: env.TESSERACT_SANDBOX_ID || hostname(),
    });
  } catch (error) {
    if (error instanceof HostConfigError || error instanceof ConfigError) throw new CliError(error.message, 2);
    throw error;
  }
}

function linkTarget(path: string): string | null {
  try {
    return lstatSync(path).isSymbolicLink() ? realpathSync(resolve(path, "..", readlinkSync(path))) : null;
  } catch {
    return null;
  }
}

function resolveRepository(config: Config, repo: string): string {
  let path: string;
  try {
    path = realpathSync(repo);
  } catch {
    throw new CliError(`${repo} does not exist`, 2);
  }
  if (!statSync(path).isDirectory()) throw new CliError(`${path} is not a directory`, 2);
  if (isInside(realpathSync(config.workspace), path)) throw new CliError(`${path} is inside the host workspace ${config.workspace}`, 2);
  return path;
}

/** Links `repo` as `<projectsDir>/<id>`; the same repository keeps its id, another one with the same name gets `-2`, `-3`, … */
export function linkRepository(config: Config, repo: string, name?: string): { id: string; path: string; created: boolean } {
  const path = resolveRepository(config, repo);
  const base = projectIdFromName(name ?? basename(path));
  if (!base) throw new CliError(`Cannot derive a project id from "${name ?? basename(path)}"; pass --name`, 2);
  mkdirSync(config.projectsDir, { recursive: true });
  for (let attempt = 1; attempt <= MAX_ID_SUFFIX; attempt += 1) {
    const id = attempt === 1 ? base : `${base}-${attempt}`;
    const entry = join(config.projectsDir, id);
    const target = linkTarget(entry);
    if (target === path) return { id, path, created: false };
    try {
      lstatSync(entry);
      continue;
    } catch {}
    symlinkSync(path, entry, "dir");
    return { id, path, created: true };
  }
  throw new CliError(`Too many host projects named ${base}`, 2);
}

/** Links `repo` as exactly `<projectsDir>/<id>`, re-pointing an existing link; a real directory with that id is left alone. */
export function linkRepositoryAs(config: Config, repo: string, id: string): { id: string; path: string; created: boolean } {
  if (!isValidProjectId(id)) throw new CliError(`"${id}" is not a valid project id`, 2);
  const path = resolveRepository(config, repo);
  mkdirSync(config.projectsDir, { recursive: true });
  const entry = join(config.projectsDir, id);
  if (linkTarget(entry) === path) return { id, path, created: false };
  const existing = entryKind(entry);
  if (existing === "directory") throw new CliError(`${entry} is a directory, not a link to a host repository`, 2);
  if (existing === "missing") {
    symlinkSync(path, entry, "dir");
  } else {
    const temp = `${entry}.${process.pid}.tmp`;
    symlinkSync(path, temp, "dir");
    renameSync(temp, entry);
  }
  return { id, path, created: true };
}

function entryKind(path: string): "missing" | "link" | "directory" {
  try {
    return lstatSync(path).isSymbolicLink() ? "link" : "directory";
  } catch {
    return "missing";
  }
}

/** The repositories linked into the host workspace, as `{ id, path }` (dangling links are skipped). */
export function linkedRepositories(config: Config): { id: string; path: string }[] {
  let names: string[];
  try {
    names = readdirSync(config.projectsDir);
  } catch {
    return [];
  }
  return names
    .filter(isValidProjectId)
    .flatMap((id) => {
      const path = linkTarget(join(config.projectsDir, id));
      return path ? [{ id, path }] : [];
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export interface WorkspacePairing {
  link: string;
  url: string;
  localUrl: string;
  name: string;
  token: string;
}

/** Pairing details of the host workspace controller; `null` when it has no token yet and `create` is false. */
export function workspacePairing(env: Env, create: boolean): WorkspacePairing | null {
  const config = loadHostWorkspaceConfig(env, {}, !env.TESSERACT_HOST_WORKSPACE_BIND);
  if (create) ensureDirectories(config);
  const resolved = resolveToken(config, { create });
  if (!resolved) {
    if (create) throw new CliError("Could not load or create the host workspace token");
    return null;
  }
  const url = env.TESSERACT_HOST_WORKSPACE_PUBLIC_URL ? config.publicUrl : (tailscaleServeUrl(config.host, config.port, env) ?? config.publicUrl);
  const name = `${config.sandboxId} (host)`;
  return { link: buildPairingLink({ url, token: resolved.token, name }), url, localUrl: localApiUrl(config), name, token: resolved.token };
}

/** `GET /v1/host/workspace` of the host shell daemon: how a PIN-unlocked device reaches the host workspace controller. */
export function hostWorkspaceAccess(env: Env): HostWorkspaceAccess | null {
  const pairing = workspacePairing(env, false);
  if (!pairing) return null;
  const config = loadHostWorkspaceConfig(env, {}, false);
  return { url: pairing.url, token: pairing.token, name: pairing.name, projects: linkedRepositories(config) };
}

const pidFile = (config: Config) => join(config.dataDir, "serve.pid");

function serve(args: string[], io: HostCliIo): null {
  const { values } = parseArgs({ args, options: { bind: { type: "string" }, port: { type: "string" } }, strict: true });
  const config = loadHostWorkspaceConfig(io.env, values);
  // Claude Code and its commands inherit this process's env: give them the SDK and JDK chosen for the host shell.
  Object.assign(process.env, savedToolchainEnv(io.env));
  const controller = startController(config);
  writeFileSync(pidFile(config), `${process.pid}\n`, { mode: 0o600 });
  const shutdown = () =>
    void controller.stop().finally(() => {
      rmSync(pidFile(config), { force: true });
      process.exit(0);
    });
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  return null;
}

/** SIGTERMs the `serve` recorded in the pid file; `false` when none is running. */
export function stopWorkspace(config: Config): boolean {
  let pid: number;
  try {
    pid = Number.parseInt(readFileSync(pidFile(config), "utf8").trim(), 10);
  } catch {
    return false;
  }
  rmSync(pidFile(config), { force: true });
  if (!Number.isInteger(pid) || pid <= 1) return false;
  try {
    process.kill(pid, "SIGTERM");
    return true;
  } catch {
    return false;
  }
}

function stop(args: string[], io: HostCliIo): number {
  const { values } = parseArgs({ args, options: { json: { type: "boolean", default: false } }, strict: true });
  const stopped = stopWorkspace(loadHostWorkspaceConfig(io.env, {}, false));
  io.output.out(values.json ? JSON.stringify({ stopped }) : stopped ? "Stopped the host workspace" : "The host workspace is not running");
  return 0;
}

function add(args: string[], io: HostCliIo): number {
  const { values, positionals } = parseArgs({
    args,
    options: { name: { type: "string" }, id: { type: "string" }, json: { type: "boolean", default: false } },
    allowPositionals: true,
    strict: true,
  });
  if (positionals.length > 1) throw new CliError("host workspace add takes at most one path", 2);
  if (values.name !== undefined && values.id !== undefined) throw new CliError("Pass either --name or --id, not both", 2);
  const config = loadHostWorkspaceConfig(io.env, {}, false);
  ensureDirectories(config);
  const repo = resolve(io.cwd ?? process.cwd(), positionals[0] ?? ".");
  const linked = values.id !== undefined ? linkRepositoryAs(config, repo, values.id) : linkRepository(config, repo, values.name);
  if (values.json) io.output.out(JSON.stringify(linked));
  else io.output.out(`${linked.created ? "Linked" : "Already linked"} ${linked.path} as host project ${linked.id}`);
  return 0;
}

function pair(args: string[], io: HostCliIo): number {
  const { values } = parseArgs({ args, options: { json: { type: "boolean", default: false } }, strict: true });
  const pairing = workspacePairing(io.env, true);
  if (!pairing) throw new CliError("Could not load or create the host workspace token");
  const { link, url, localUrl, name } = pairing;
  if (values.json) {
    io.output.out(JSON.stringify({ link, url, localUrl, name }));
    return 0;
  }
  io.output.out(renderANSI(link, { ecc: "L", border: 2 }));
  io.output.out(`Scan with the Tesseract app, or open this link on the phone:\n\n  ${link}\n`);
  io.output.out(`Host workspace ${name} · ${url}`);
  io.output.err("The link contains the host workspace token: share it only with your own devices.");
  return 0;
}

export function hostWorkspaceCli(args: string[], io: HostCliIo): number | null {
  const [command, ...rest] = args;
  switch (command) {
    case "serve":
      return serve(rest, io);
    case "add":
      return add(rest, io);
    case "pair":
      return pair(rest, io);
    case "stop":
      return stop(rest, io);
    default:
      throw new CliError(`Unknown host workspace command "${command ?? ""}"; expected serve, add, stop or pair`, 2);
  }
}
