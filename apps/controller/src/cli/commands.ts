import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { renderANSI } from "uqr";
import { buildPairingLink, isIdOfKind, restPaths, ShareArtifactSchema, StatusEventInputSchema, validate, type Artifact, type SandboxStatus } from "@theone/protocol";
import { resolveToken, rotateToken } from "../auth/token";
import { loadConfig, type Config } from "../config";
import type { Env } from "../core/exec";
import { startController } from "../server";
import { formatBytes } from "../services/artifacts";
import { VERSION } from "../version";
import { api, API_USAGE, redactVncPasswords } from "./api";
import { hook } from "./hook";
import { callLocalApi, CliError, isControllerUp } from "./local-api";
import { consoleOutput, type Output } from "./output";

export type { Output } from "./output";

export const USAGE = `theone-controller ${VERSION}

Usage:
  theone-controller [serve]          run the daemon (default)
  theone-controller pair [--json]    print the pairing deep link and a QR code
  theone-controller status [--json]  print the sandbox status from the local API
  theone-controller emit --status <s> --message <m> [--project <p>] [--stage <s>] [--platform <p>]
  theone-controller token [--rotate] print the API token, or replace it (restart required)
  ${API_USAGE}
                                     call the local API (GET, POST or DELETE; PATH under /v1/; body as an
                                     argument or "-" for stdin); prints the JSON response, VNC password redacted
  theone-controller share <file> [--project <id>] [--name <name>] [--note <text>] [--json]
                                     copy a workspace file into the artifacts, announce it in the inbox and
                                     make it downloadable on paired devices (tags the Claude run/session)
  theone-controller hook             forward a Claude Code hook (JSON on stdin) to the inbox; silent, always exits 0
  theone-controller --version | --help`;

export type CliIo = { env?: Env; output?: Output; readStdin?: () => Promise<string>; cwd?: string };

const readProcessStdin = () => Bun.stdin.text();

function gib(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
}

export function formatStatus(status: SandboxStatus): string {
  const { resources, display, counts } = status;
  const tools = status.tools.map((tool) => `${tool.name} ${tool.version ?? "missing"}`).join(", ");
  return [
    `Sandbox   ${status.sandboxId} (${status.hostname}) · controller ${status.version} · up ${Math.round(status.uptimeSec / 60)} min`,
    `CPU       ${resources.cpu.cores} cores · load ${resources.cpu.load1.toFixed(2)} ${resources.cpu.load5.toFixed(2)} ${resources.cpu.load15.toFixed(2)}`,
    `Memory    ${gib(resources.memory.usedBytes)} / ${gib(resources.memory.totalBytes)}`,
    `Disk      ${gib(resources.disk.usedBytes)} / ${gib(resources.disk.totalBytes)} (${resources.disk.path})`,
    `Display   ${display.display} ${display.available ? `up${display.width ? ` ${display.width}x${display.height}` : ""}` : "down"} · VNC ${display.vnc.port} ${display.vnc.available ? "up" : "down"}`,
    `Work      ${counts.projects} projects · ${counts.runningProcesses} processes · ${counts.activeBuilds} builds · ${counts.terminals} terminals · ${counts.agentRuns} agent runs`,
    `Tools     ${tools}`,
  ].join("\n");
}

function serve(config: Config): null {
  const controller = startController(config);
  const shutdown = (signal: string) => {
    controller.services.logger.info("shutting down", { signal });
    void controller.stop().finally(() => process.exit(0));
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  return null;
}

async function pair(config: Config, args: string[], output: Output): Promise<number> {
  const { values } = parseArgs({ args, options: { json: { type: "boolean", default: false } }, strict: true });
  const resolved = resolveToken(config, { create: true });
  if (!resolved) throw new CliError("Could not load or create the API token");
  const link = buildPairingLink({ url: config.publicUrl, token: resolved.token, name: config.sandboxId });
  if (values.json) {
    output.out(JSON.stringify({ link, url: config.publicUrl, name: config.sandboxId }));
    return 0;
  }
  output.out(renderANSI(link, { ecc: "L", border: 2 }));
  output.out(`Scan with the TheOne app, or open this link on the phone:\n\n  ${link}\n`);
  output.out(`Sandbox ${config.sandboxId} · ${config.publicUrl}`);
  if (!(await isControllerUp(config))) output.err("warning: the controller is not answering on the local port yet");
  output.err("The link contains the API token: share it only with your own devices.");
  return 0;
}

async function status(config: Config, args: string[], output: Output): Promise<number> {
  const { values } = parseArgs({ args, options: { json: { type: "boolean", default: false } }, strict: true });
  const result = await callLocalApi<SandboxStatus>(config, "GET", "/v1/status");
  if (!result) throw new CliError("Empty status response");
  output.out(values.json ? JSON.stringify(redactVncPasswords(result), null, 2) : formatStatus(result));
  return 0;
}

async function emit(config: Config, args: string[], output: Output): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      status: { type: "string" },
      message: { type: "string" },
      project: { type: "string" },
      stage: { type: "string" },
      platform: { type: "string" },
    },
    strict: true,
  });
  const event = validate(StatusEventInputSchema, {
    status: values.status,
    message: values.message,
    project: values.project ?? null,
    ...(values.stage ? { stage: values.stage } : {}),
    ...(values.platform ? { platform: values.platform } : {}),
  });
  if (!event.ok) throw new CliError(`Invalid event: ${event.error.message}\n\n${USAGE}`, 2);
  await callLocalApi(config, "POST", "/v1/events", event.value);
  output.out(`emitted ${event.value.status}${event.value.project ? ` for ${event.value.project}` : ""}`);
  return 0;
}

async function share(config: Config, args: string[], env: Env, cwd: string, output: Output): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      project: { type: "string" },
      name: { type: "string" },
      note: { type: "string" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: true,
  });
  if (positionals.length !== 1) throw new CliError(`share takes exactly one file\n\n${USAGE}`, 2);
  const input = validate(ShareArtifactSchema, {
    path: resolve(cwd, positionals[0] ?? ""),
    ...(values.project ? { projectId: values.project } : {}),
    ...(values.name ? { name: values.name } : {}),
    ...(values.note ? { note: values.note } : {}),
    ...(env.THEONE_AGENT_RUN_ID && isIdOfKind("agentRun", env.THEONE_AGENT_RUN_ID) ? { agentRunId: env.THEONE_AGENT_RUN_ID } : {}),
    ...(env.CLAUDE_CODE_SESSION_ID ? { sessionId: env.CLAUDE_CODE_SESSION_ID } : {}),
  });
  if (!input.ok) throw new CliError(`Invalid share: ${input.error.message}`, 2);
  const artifact = await callLocalApi<Artifact>(config, "POST", restPaths.artifacts(), input.value);
  if (!artifact) throw new CliError("Empty share response");
  output.out(values.json ? JSON.stringify(artifact) : `shared ${artifact.fileName} (${formatBytes(artifact.sizeBytes)}, ${artifact.projectId}) as ${artifact.id}`);
  return 0;
}

function token(config: Config, args: string[], output: Output): number {
  const { values } = parseArgs({ args, options: { rotate: { type: "boolean", default: false } }, strict: true });
  if (!values.rotate) {
    const resolved = resolveToken(config, { create: true });
    if (!resolved) throw new CliError("Could not load or create the API token");
    output.out(resolved.token);
    return 0;
  }
  rotateToken(config);
  output.out(`Wrote a new token to ${config.tokenFile} (mode 0600).`);
  output.out("Restart the controller to apply it, then pair every phone again (theone-controller pair).");
  if (config.tokenFromEnv) output.err("warning: THEONE_TOKEN is set and overrides the token file; unset it for the new token to take effect.");
  return 0;
}

/** Returns the exit code, or null when the daemon keeps running. */
export async function runCli(argv: string[], io: CliIo = {}): Promise<number | null> {
  const output = io.output ?? consoleOutput;
  const [command = "serve", ...rest] = argv;
  if (command === "--help" || command === "-h" || command === "help") {
    output.out(USAGE);
    return 0;
  }
  if (command === "--version" || command === "-v" || command === "version") {
    output.out(VERSION);
    return 0;
  }
  if (command === "hook") return hook(io.env ?? process.env, io.readStdin ?? readProcessStdin);
  try {
    const config = loadConfig(io.env ?? process.env);
    switch (command) {
      case "serve":
        return serve(config);
      case "pair":
        return await pair(config, rest, output);
      case "status":
        return await status(config, rest, output);
      case "emit":
        return await emit(config, rest, output);
      case "token":
        return token(config, rest, output);
      case "share":
        return await share(config, rest, io.env ?? process.env, io.cwd ?? process.cwd(), output);
      case "api":
        return await api(config, rest, output, io.readStdin ?? readProcessStdin);
      default:
        output.err(`Unknown command "${command}"\n\n${USAGE}`);
        return 2;
    }
  } catch (error) {
    if (error instanceof CliError) {
      output.err(`error: ${error.message}`);
      return error.exitCode;
    }
    if (error instanceof Error && (error as NodeJS.ErrnoException).code?.startsWith("ERR_PARSE_ARGS")) {
      output.err(`error: ${error.message}\n\n${USAGE}`);
      return 2;
    }
    output.err(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
