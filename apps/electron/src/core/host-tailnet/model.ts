import { join } from "node:path";
import { TailnetStatusSchema, type TailnetStatus } from "@tesseract/protocol";
import type { HostTailnetMode } from "../../shared/contracts/tailnet";
import { BUILDER_OS, HOST_TAILNET, HOST_TAILNET_ENV } from "./constants";

export interface TailnetBinaryOptions {
  packaged: boolean;
  resourcesPath: string | null;
  repoRoot: string | null;
  platform: NodeJS.Platform;
  arch: string;
}

function executable(platform: NodeJS.Platform): string {
  return platform === "win32" ? `${HOST_TAILNET.binary}.exe` : HOST_TAILNET.binary;
}

/** `<resources>/bin/tesseract-tailnet` when packaged, `apps/electron/resources/bin/<os>-<arch>/tesseract-tailnet` in a checkout. */
export function tailnetBinaryPath(options: TailnetBinaryOptions): string | null {
  const name = executable(options.platform);
  if (options.packaged && options.resourcesPath) return join(options.resourcesPath, HOST_TAILNET.bundledDir, name);
  if (!options.repoRoot) return null;
  const os = BUILDER_OS[options.platform] ?? options.platform;
  return join(options.repoRoot, ...HOST_TAILNET.devDir, `${os}-${options.arch}`, name);
}

/** `<computer>-host`, reduced to a valid Tesseract Network hostname (protocol `TailnetHostnameSchema`). */
export function hostTailnetHostname(machine: string): string {
  const base = machine
    .toLowerCase()
    .split(".")[0]!
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, HOST_TAILNET.maxHostnameLength - HOST_TAILNET.hostSuffix.length)
    .replace(/-+$/, "");
  return `${base || HOST_TAILNET.fallbackHost}${HOST_TAILNET.hostSuffix}`;
}

export interface TailnetUpOptions {
  stateDir: string;
  loginServer: string;
  authKey: string | null;
  hostname: string;
}

/** `tesseract-tailnet up …` serving the host shell (7701) and host workspace (7702) from loopback (ADR 0014 §3). */
export function tailnetUpArgs(options: TailnetUpOptions): string[] {
  const { shell, workspace } = HOST_TAILNET.ports;
  return [
    "up",
    "--state-dir",
    options.stateDir,
    "--login-server",
    options.loginServer,
    ...(options.authKey ? ["--auth-key", options.authKey] : []),
    "--hostname",
    options.hostname,
    "--serve",
    `${shell}=${HOST_TAILNET.loopback}:${shell}`,
    "--serve",
    `${workspace}=${HOST_TAILNET.loopback}:${workspace}`,
  ];
}

/** One stdout line of the CLI: a `TailnetStatus` JSON object, else null (log noise). */
export function parseStatusLine(line: string): TailnetStatus | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = TailnetStatusSchema.safeParse(JSON.parse(trimmed));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function backoffMs(attempt: number): number {
  const steps = HOST_TAILNET.backoffMs;
  return steps[Math.min(Math.max(attempt, 0), steps.length - 1)]!;
}

export function hostTailnetEnabled(mode: HostTailnetMode, signedIn: boolean, tailscaleDetected: boolean): boolean {
  if (!signedIn || mode === "off") return false;
  return mode === "on" || !tailscaleDetected;
}

/** The node's MagicDNS name: the reported one (Headscale may rename on a clash), else `<hostname>.<suffix>`. */
export function nodeDnsName(hostname: string, suffix: string, node: TailnetStatus | null): string {
  const reported = node?.state === "running" ? node.dnsName?.replace(/\.$/, "") : null;
  return reported || `${hostname}.${suffix.replace(/^\.|\.$/g, "")}`;
}

export function tailnetUrls(dnsName: string): { shell: string; workspace: string } {
  const { shell, workspace } = HOST_TAILNET.ports;
  return { shell: `http://${dnsName}:${shell}`, workspace: `http://${dnsName}:${workspace}` };
}

/** Daemon env for loopback binds behind the node's `--serve`, so pairing links carry the Tesseract Network name. */
export function hostTailnetEnv(urls: { shell: string; workspace: string } | null): Record<string, string | undefined> {
  if (!urls) return {};
  return {
    [HOST_TAILNET_ENV.shellBind]: HOST_TAILNET.loopback,
    [HOST_TAILNET_ENV.shellPublicUrl]: urls.shell,
    [HOST_TAILNET_ENV.workspaceBind]: HOST_TAILNET.loopback,
    [HOST_TAILNET_ENV.workspacePublicUrl]: urls.workspace,
  };
}
