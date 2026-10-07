import { existsSync } from "node:fs";
import { hostname, homedir } from "node:os";
import { join } from "node:path";
import { HOST_SHELL_PORT } from "@theone/protocol";
import type { Env } from "../core/exec";
import { loadAndroidConfig, type AndroidConfig } from "./android/config";

export type HostConfig = {
  bind: string;
  port: number;
  stateDir: string;
  stateFile: string;
  publicUrl: string;
  hostId: string;
  home: string;
  shell: string[];
  android: AndroidConfig;
};

export type HostOverrides = { bind?: string; port?: string };

export class HostConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HostConfigError";
  }
}

const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function ipv4Octets(address: string): number[] | null {
  const match = IPV4_PATTERN.exec(address);
  if (!match) return null;
  const octets = match.slice(1).map(Number);
  return octets.every((octet) => octet <= 255) ? octets : null;
}

/** Only loopback (tests, a local tunnel) and Tailscale's 100.64.0.0/10 range: the daemon hands out a host shell. */
export function validateBind(address: string): string {
  const trimmed = address.trim();
  const octets = ipv4Octets(trimmed);
  if (!octets) throw new HostConfigError(`Bind address "${trimmed}" is not an IPv4 address`);
  const [first = 0, second = 0] = octets;
  if (octets.every((octet) => octet === 0)) throw new HostConfigError("Refusing to listen on every interface (0.0.0.0); bind the host's Tailscale IPv4");
  if (first === 127) return trimmed;
  if (first === 100 && second >= 64 && second <= 127) return trimmed;
  throw new HostConfigError(`Refusing to bind ${trimmed}: only a Tailscale address (100.64.0.0/10) or loopback is allowed`);
}

export function validatePort(value: string): number {
  const port = Number(value);
  if (!/^\d+$/.test(value) || !Number.isInteger(port) || port > 65535) throw new HostConfigError(`Invalid port "${value}"`);
  return port;
}

/** Homebrew's prefixes: launchd starts the daemon with only `/usr/bin:/bin:/usr/sbin:/sbin` on PATH. */
const DARWIN_TOOL_DIRS = ["/opt/homebrew/bin", "/usr/local/bin"];
const TAILSCALE_APP_CLI = "/Applications/Tailscale.app/Contents/MacOS/Tailscale";

/** PATH for finding host tools (adb, scrcpy, ffmpeg, tailscale), with Homebrew's prefixes appended on macOS. */
export function hostToolPath(env: Env, platform: NodeJS.Platform = process.platform): string {
  const path = env.PATH ?? "";
  if (platform !== "darwin") return path;
  return [path, ...DARWIN_TOOL_DIRS].filter(Boolean).join(":");
}

/** `tailscale` on PATH (plus Homebrew's prefixes), else the CLI inside the macOS app, which installs no symlink. */
export function tailscaleBin(env: Env = process.env, platform: NodeJS.Platform = process.platform, exists: (path: string) => boolean = existsSync): string | null {
  const found = Bun.which("tailscale", { PATH: hostToolPath(env, platform) });
  if (found) return found;
  return platform === "darwin" && exists(TAILSCALE_APP_CLI) ? TAILSCALE_APP_CLI : null;
}

export function tailscaleIpv4(env: Env = process.env): string {
  const bin = tailscaleBin(env);
  if (!bin) throw new HostConfigError("tailscale is not installed; install it on the host or pass --bind <ipv4>");
  let result: Bun.SyncSubprocess<"pipe", "pipe">;
  try {
    result = Bun.spawnSync([bin, "ip", "-4"], { stdout: "pipe", stderr: "pipe" });
  } catch {
    throw new HostConfigError("tailscale is not installed; install it on the host or pass --bind <ipv4>");
  }
  const address = result.stdout.toString().split("\n")[0]?.trim() ?? "";
  if (!result.success || !address) {
    const detail = result.stderr.toString().trim();
    throw new HostConfigError(`Could not read the host's Tailscale IPv4 (is tailscale up?)${detail ? `: ${detail}` : ""}`);
  }
  return address;
}

type ServeStatus = { Web?: Record<string, { Handlers?: Record<string, { Proxy?: string }> }> };

/** The `https://<magicdns>[:port]` that `tailscale serve` proxies to `http://<bind>:<port>` at `/`, if any. */
export function servedUrl(status: ServeStatus, bind: string, port: number): string | null {
  const targets = new Set([`http://${bind}:${port}`, `${bind}:${port}`]);
  if (bind.startsWith("127.")) targets.add(`http://localhost:${port}`).add(`localhost:${port}`).add(String(port));
  for (const [hostPort, web] of Object.entries(status.Web ?? {})) {
    const proxy = web.Handlers?.["/"]?.Proxy?.replace(/\/$/, "");
    if (proxy && targets.has(proxy)) return `https://${hostPort.replace(/:443$/, "")}`;
  }
  return null;
}

/** Asks tailscaled for its serve config; null when tailscale is missing, down or serves nothing for this daemon. */
export function tailscaleServeUrl(bind: string, port: number, env: Env = process.env): string | null {
  const bin = tailscaleBin(env);
  if (!bin) return null;
  try {
    const result = Bun.spawnSync([bin, "serve", "status", "--json"], { stdout: "pipe", stderr: "pipe" });
    if (!result.success) return null;
    return servedUrl(JSON.parse(result.stdout.toString() || "{}") as ServeStatus, bind, port);
  } catch {
    return null;
  }
}

export function hostStateDir(env: Env): string {
  if (env.THEONE_HOST_SHELL_DIR) return env.THEONE_HOST_SHELL_DIR;
  const base = env.XDG_CONFIG_HOME || join(env.HOME || homedir(), ".config");
  return join(base, "theone", "host-shell");
}

/** Bind and port are resolved only when `resolveBind` is set (serve, pair), so `pin`/`token` work without Tailscale. */
/** macOS has no `bash -l` worth using (3.2) and launchd sets no SHELL, so default to the system zsh there. */
export const defaultShell = (platform: NodeJS.Platform) => (platform === "darwin" ? "/bin/zsh" : "bash");

export function loadHostConfig(env: Env, overrides: HostOverrides = {}, resolveBind = true, platform: NodeJS.Platform = process.platform): HostConfig {
  const stateDir = hostStateDir(env);
  const port = validatePort(overrides.port ?? env.THEONE_HOST_SHELL_PORT ?? String(HOST_SHELL_PORT));
  const requested = overrides.bind ?? env.THEONE_HOST_SHELL_BIND;
  let bind = "";
  if (requested !== undefined) {
    if (!requested.trim() || requested.trim() === "::") throw new HostConfigError("Refusing to listen on every interface; bind the host's Tailscale IPv4");
    bind = validateBind(requested);
  } else if (resolveBind) {
    bind = validateBind(tailscaleIpv4(env));
  }
  const home = env.HOME || homedir();
  return {
    bind,
    port,
    stateDir,
    stateFile: join(stateDir, "state.json"),
    publicUrl: env.THEONE_HOST_SHELL_PUBLIC_URL || `http://${bind}:${port}`,
    hostId: hostname(),
    home,
    shell: [env.SHELL || defaultShell(platform), "-l"],
    android: loadAndroidConfig(env, platform),
  };
}
