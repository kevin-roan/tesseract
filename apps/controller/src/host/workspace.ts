import { lstatSync, mkdirSync, readlinkSync, realpathSync, statSync, symlinkSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { renderANSI } from "uqr";
import { buildPairingLink, HOST_WORKSPACE_PORT, projectIdFromName } from "@tesseract/protocol";
import { resolveToken } from "../auth/token";
import { CliError } from "../cli/local-api";
import { ConfigError, ensureDirectories, loadConfig, localApiUrl, type Config } from "../config";
import type { Env } from "../core/exec";
import { isInside } from "../core/paths";
import { startController } from "../server";
import { HostConfigError, tailscaleIpv4, tailscaleServeUrl, validateBind, validatePort } from "./config";
import type { HostCliIo } from "./cli";

export const HOST_WORKSPACE_USAGE = `  tesseract-controller host workspace serve [--bind <ipv4>] [--port <n>]
                                     run the host workspace controller (on the host, no sandbox) on the host's
                                     Tailscale IPv4 (or loopback), port ${HOST_WORKSPACE_PORT}; its projects are links to host
                                     repositories and Claude edits them in place (TESSERACT_HOST_WORKSPACE,
                                     TESSERACT_HOST_WORKSPACE_BIND, TESSERACT_HOST_WORKSPACE_PORT, TESSERACT_HOST_WORKSPACE_PUBLIC_URL)
  tesseract-controller host workspace add [<path>] [--name <name>] [--json]
                                     link a host repository (default: the current directory) into the host workspace;
                                     --json prints { id, path, created }
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

/** Links `repo` as `<projectsDir>/<id>`; the same repository keeps its id, another one with the same name gets `-2`, `-3`, … */
export function linkRepository(config: Config, repo: string, name?: string): { id: string; path: string; created: boolean } {
  let path: string;
  try {
    path = realpathSync(repo);
  } catch {
    throw new CliError(`${repo} does not exist`, 2);
  }
  if (!statSync(path).isDirectory()) throw new CliError(`${path} is not a directory`, 2);
  if (isInside(realpathSync(config.workspace), path)) throw new CliError(`${path} is inside the host workspace ${config.workspace}`, 2);
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

function serve(args: string[], io: HostCliIo): null {
  const { values } = parseArgs({ args, options: { bind: { type: "string" }, port: { type: "string" } }, strict: true });
  const controller = startController(loadHostWorkspaceConfig(io.env, values));
  const shutdown = () => void controller.stop().finally(() => process.exit(0));
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  return null;
}

function add(args: string[], io: HostCliIo): number {
  const { values, positionals } = parseArgs({
    args,
    options: { name: { type: "string" }, json: { type: "boolean", default: false } },
    allowPositionals: true,
    strict: true,
  });
  if (positionals.length > 1) throw new CliError("host workspace add takes at most one path", 2);
  const config = loadHostWorkspaceConfig(io.env, {}, false);
  ensureDirectories(config);
  const linked = linkRepository(config, resolve(io.cwd ?? process.cwd(), positionals[0] ?? "."), values.name);
  if (values.json) io.output.out(JSON.stringify(linked));
  else io.output.out(`${linked.created ? "Linked" : "Already linked"} ${linked.path} as host project ${linked.id}`);
  return 0;
}

function pair(args: string[], io: HostCliIo): number {
  const { values } = parseArgs({ args, options: { json: { type: "boolean", default: false } }, strict: true });
  const config = loadHostWorkspaceConfig(io.env, {}, !io.env.TESSERACT_HOST_WORKSPACE_BIND);
  ensureDirectories(config);
  const resolved = resolveToken(config, { create: true });
  if (!resolved) throw new CliError("Could not load or create the host workspace token");
  const url = io.env.TESSERACT_HOST_WORKSPACE_PUBLIC_URL ? config.publicUrl : (tailscaleServeUrl(config.host, config.port, io.env) ?? config.publicUrl);
  const name = `${config.sandboxId} (host)`;
  const link = buildPairingLink({ url, token: resolved.token, name });
  const localUrl = localApiUrl(config);
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
    default:
      throw new CliError(`Unknown host workspace command "${command ?? ""}"; expected serve, add or pair`, 2);
  }
}
