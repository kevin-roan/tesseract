import { dirname, join } from "node:path";
import { HOST_SHELL_PORT } from "@tesseract/protocol";
import { CONTROLLER_BINARY, executableName, findExecutable, nodeFileProbe, splitCommand, type FileProbe } from "../../src/core/host";
import type { BuildMode, ReachabilityMode, SandboxComponent, SetupChoices } from "../../src/shared/contracts/sandbox";
import { ENV } from "../../src/shared/runtime";
import { SERVER } from "../constants";

export interface ServerOptions {
  mode: ReachabilityMode;
  hostname: string | null;
  tailnetDomain: string | null;
  authKey: string | null;
  components: SandboxComponent[] | null;
  image: string | null;
  build: boolean;
  claudeToken: string | null;
  hostShell: boolean;
  httpsPort: number;
  dryRun: boolean;
}

export interface ServiceCommand {
  file: string;
  args: string[];
  optional?: boolean;
  retries?: number;
}

export interface HostServiceInput {
  platform: NodeJS.Platform;
  home: string;
  uid: number;
  command: readonly string[];
  bind: string;
  port?: number;
  tailscale: string | null;
  env: NodeJS.ProcessEnv;
}

export interface HostServicePlan {
  kind: "launchd" | "systemd";
  file: string;
  text: string;
  logDir: string | null;
  install: ServiceCommand[];
  uninstall: ServiceCommand[];
  status: ServiceCommand;
}

export interface ServerState {
  httpsPort: number | null;
  bind: string | null;
  serviceFile: string | null;
  tailscale: string | null;
}

export function resolveTailscale(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  files: FileProbe = nodeFileProbe,
): string | null {
  const onPath = findExecutable(SERVER.tailscaleBinary, env, platform, files);
  if (onPath) return onPath;
  const fallbacks: readonly string[] = platform === "darwin" || platform === "linux" ? SERVER.tailscaleFallbacks[platform] : [];
  return fallbacks.find((path) => files.isExecutable(path)) ?? null;
}

export function controllerCommand(
  execPath: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  files: FileProbe = nodeFileProbe,
): string[] | null {
  const override = env[ENV.controllerCommand]?.trim();
  if (override) return splitCommand(override);
  const sibling = join(dirname(execPath), executableName(CONTROLLER_BINARY, platform));
  return files.isExecutable(sibling) ? [sibling] : null;
}

export function servicePath(tailscale: string | null): string {
  const dirs = [...(tailscale ? [dirname(tailscale)] : []), ...SERVER.servicePath];
  return [...new Set(dirs)].join(":");
}

export function serviceEnv(input: Pick<HostServiceInput, "env" | "home" | "tailscale">): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of SERVER.serviceEnvKeys) {
    const value = input.env[key];
    if (value) result[key] = value;
  }
  result.HOME = input.home;
  result.PATH = servicePath(input.tailscale);
  return result;
}

export function serveArgs(input: Pick<HostServiceInput, "command" | "bind" | "port">): string[] {
  return [...input.command, "host", "serve", "--bind", input.bind, ...(input.port ? ["--port", String(input.port)] : [])];
}

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function launchdPlist(label: string, args: readonly string[], env: Record<string, string>, logDir: string): string {
  const strings = (values: readonly string[], indent: string) => values.map((value) => `${indent}<string>${xml(value)}</string>`);
  const envLines = Object.entries(env).flatMap(([key, value]) => [`    <key>${xml(key)}</key>`, `    <string>${xml(value)}</string>`]);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    "<dict>",
    "  <key>Label</key>",
    `  <string>${xml(label)}</string>`,
    "  <key>ProgramArguments</key>",
    "  <array>",
    ...strings(args, "    "),
    "  </array>",
    "  <key>EnvironmentVariables</key>",
    "  <dict>",
    ...envLines,
    "  </dict>",
    "  <key>RunAtLoad</key>",
    "  <true/>",
    "  <key>KeepAlive</key>",
    "  <true/>",
    "  <key>ThrottleInterval</key>",
    "  <integer>10</integer>",
    "  <key>ProcessType</key>",
    "  <string>Interactive</string>",
    "  <key>StandardOutPath</key>",
    `  <string>${xml(join(logDir, SERVER.logFiles.out))}</string>`,
    "  <key>StandardErrorPath</key>",
    `  <string>${xml(join(logDir, SERVER.logFiles.err))}</string>`,
    "</dict>",
    "</plist>",
    "",
  ].join("\n");
}

function systemdQuote(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function systemdUnit(args: readonly string[], env: Record<string, string>): string {
  return [
    "[Unit]",
    "Description=Tesseract host shell (tesseract-controller host serve)",
    "After=network-online.target tailscaled.service",
    "Wants=network-online.target",
    "",
    "[Service]",
    "Type=simple",
    `ExecStart=${args.map(systemdQuote).join(" ")}`,
    ...Object.entries(env).map(([key, value]) => `Environment=${systemdQuote(`${key}=${value}`)}`),
    "Restart=always",
    "RestartSec=5",
    "",
    "[Install]",
    "WantedBy=default.target",
    "",
  ].join("\n");
}

export function planHostService(input: HostServiceInput): HostServicePlan {
  const args = serveArgs(input);
  const env = serviceEnv(input);
  if (input.platform === "darwin") {
    const label = SERVER.serviceLabel;
    const file = join(input.home, ...SERVER.launchAgentDir, `${label}.plist`);
    const logDir = join(input.home, ...SERVER.logDir);
    const domain = `gui/${input.uid}`;
    return {
      kind: "launchd",
      file,
      text: launchdPlist(label, args, env, logDir),
      logDir,
      install: [
        { file: "launchctl", args: ["bootout", `${domain}/${label}`], optional: true },
        { file: "launchctl", args: ["bootstrap", domain, file], retries: SERVER.bootstrapRetries },
        { file: "launchctl", args: ["enable", `${domain}/${label}`], optional: true },
      ],
      uninstall: [{ file: "launchctl", args: ["bootout", `${domain}/${label}`], optional: true }],
      status: { file: "launchctl", args: ["print", `${domain}/${label}`] },
    };
  }
  const unit = SERVER.systemdUnit;
  return {
    kind: "systemd",
    file: join(input.home, ...SERVER.systemdUserDir, unit),
    text: systemdUnit(args, env),
    logDir: null,
    install: [
      { file: "systemctl", args: ["--user", "daemon-reload"] },
      { file: "systemctl", args: ["--user", "enable", unit] },
      { file: "systemctl", args: ["--user", "restart", unit] },
    ],
    uninstall: [
      { file: "systemctl", args: ["--user", "disable", "--now", unit], optional: true },
      { file: "systemctl", args: ["--user", "daemon-reload"], optional: true },
    ],
    status: { file: "systemctl", args: ["--user", "is-active", unit] },
  };
}

export function tailscaleServeArgs(httpsPort: number, bind: string, port: number = HOST_SHELL_PORT): string[] {
  return ["serve", "--bg", `--https=${httpsPort}`, `http://${bind}:${port}`];
}

export function tailscaleServeOffArgs(httpsPort: number): string[] {
  return ["serve", `--https=${httpsPort}`, "off"];
}

export function serveEntry(statusJson: string, httpsPort: number): string | null {
  try {
    const status = JSON.parse(statusJson) as { Web?: Record<string, { Handlers?: Record<string, { Proxy?: string }> }> };
    for (const [host, web] of Object.entries(status.Web ?? {})) {
      if (!host.endsWith(`:${httpsPort}`)) continue;
      const proxy = Object.values(web.Handlers ?? {})[0]?.Proxy ?? "";
      return `https://${host.replace(/:443$/, "")} → ${proxy}`;
    }
  } catch {
    return null;
  }
  return null;
}

export function installChoices(base: SetupChoices, options: ServerOptions, bindAddr: string | null): SetupChoices {
  return {
    ...base,
    mode: options.mode,
    tsAuthKey: options.authKey ?? "",
    tailnetDomain: options.tailnetDomain ?? base.tailnetDomain,
    hostname: options.hostname ?? base.hostname,
    bindAddr: options.mode === "host-tailscale" ? (bindAddr ?? base.bindAddr) : base.bindAddr,
    components: options.components ?? base.components,
    image: options.image ?? base.image,
  };
}

export function imageMode(options: Pick<ServerOptions, "build" | "image">, imagePresent: boolean): BuildMode {
  if (options.build) return "build";
  return imagePresent && !options.image ? "existing" : "pull";
}

export function parseServerState(text: string | null): ServerState {
  const empty: ServerState = { httpsPort: null, bind: null, serviceFile: null, tailscale: null };
  if (!text) return empty;
  try {
    const data = JSON.parse(text) as Partial<ServerState>;
    return {
      httpsPort: typeof data.httpsPort === "number" ? data.httpsPort : null,
      bind: typeof data.bind === "string" ? data.bind : null,
      serviceFile: typeof data.serviceFile === "string" ? data.serviceFile : null,
      tailscale: typeof data.tailscale === "string" ? data.tailscale : null,
    };
  } catch {
    return empty;
  }
}
