import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { userInfo } from "node:os";
import { dirname, join } from "node:path";
import { HOST_SHELL_PORT } from "@tesseract/protocol";
import { isDockerReady, phaseFromReport, probeDocker } from "../../src/core/docker";
import { CONTROLLER_BINARY } from "../../src/core/host";
import { LEGACY_LABELS, migrateEnvFile, migrateLegacyStack } from "../../src/core/legacy";
import { runCommand, commandError, type CommandResult } from "../../src/core/process";
import {
  composeDown,
  composeStatus,
  defaultChoices,
  readEnvValues,
  renderEnvFile,
  savedChoices,
  stackEndpoint,
  tailscaleVolumeExists,
  validateChoices,
  writeStack,
  type SandboxContext,
} from "../../src/core/sandbox";
import { firstHealthy } from "../../src/core/sandbox/health";
import { MODES } from "../../src/core/sandbox/constants";
import type { DockerReport } from "../../src/shared/contracts/docker";
import type { PairingInfo, SandboxStackStatus } from "../../src/shared/contracts/sandbox";
import { IpcError } from "../../src/shared/ipc-types";
import { ENV } from "../../src/shared/runtime";
import { positiveInt } from "../args";
import { REDACTED_VALUE, SERVER, SERVER_ENV } from "../constants";
import { table } from "../format";
import { emit, guarded, log, usageError } from "../io";
import { CLI_LABELS } from "../labels";
import { renderQr } from "../qr";
import {
  controllerCommand,
  imageMode,
  installChoices,
  parseServerState,
  planHostService,
  resolveTailscale,
  serveEntry,
  servicePath,
  tailscaleServeArgs,
  tailscaleServeOffArgs,
  type HostServicePlan,
  type ServerOptions,
  type ServerState,
  type ServiceCommand,
} from "../server/plan";
import { defineCommand, EXIT, type CliContext } from "../types";
import { describePairing, resolvePairingInfo } from "./pair";
import { describeServices, hostResources, parseComponents, runStackBuild } from "./sandbox";

const LABELS = CLI_LABELS.server;
const MAX_PORT = 65535;

export interface HostPairing {
  link: string;
  url: string;
  name: string;
  pinSet: boolean;
}

function optionValue(context: CliContext, flag: string, envKey?: string): string | null {
  const value = context.values.get(flag) ?? (envKey ? context.env[envKey] : undefined);
  return value?.trim() ? value.trim() : null;
}

export function serverOptions(context: CliContext): ServerOptions {
  const rawMode = context.values.get("mode") ?? SERVER.defaultMode;
  const mode = MODES.find((candidate) => candidate === rawMode);
  if (!mode) usageError(LABELS.invalidMode(rawMode, MODES.join(", ")));
  const rawPort = context.values.get("host-https-port") ?? String(SERVER.defaultHttpsPort);
  const httpsPort = positiveInt(rawPort);
  if (httpsPort === null || httpsPort > MAX_PORT) usageError(LABELS.invalidPort(rawPort));
  const withValue = context.values.get("with");
  const selection = withValue === undefined ? null : parseComponents(withValue);
  selection?.notes.forEach((note) => log(context, note));
  return {
    mode,
    hostname: optionValue(context, "hostname"),
    tailnetDomain: optionValue(context, "tailnet-domain", SERVER_ENV.tailnetDomain),
    authKey: optionValue(context, "authkey", SERVER_ENV.authKey),
    components: selection?.components ?? null,
    image: optionValue(context, "image"),
    build: context.flags.has("build"),
    claudeToken: optionValue(context, "claude-token", SERVER_ENV.claudeToken),
    hostShell: !context.flags.has("no-host-shell"),
    httpsPort,
    dryRun: context.flags.has("dry-run"),
  };
}

function commandLine(command: ServiceCommand): string {
  return [command.file, ...command.args].map((part) => (/^[\w@%+=:,./-]+$/.test(part) ? part : `'${part.replace(/'/g, "'\\''")}'`)).join(" ");
}

function run(context: CliContext, file: string, args: readonly string[], env: NodeJS.ProcessEnv = context.env): Promise<CommandResult> {
  return runCommand(file, args, { env, timeoutMs: SERVER.commandTimeoutMs, signal: context.signal });
}

async function runRequired(context: CliContext, command: ServiceCommand, env?: NodeJS.ProcessEnv): Promise<CommandResult> {
  let result = await run(context, command.file, command.args, env);
  for (let attempt = 0; result.code !== 0 && attempt < (command.retries ?? 0) && !context.signal.aborted; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, SERVER.retryDelayMs));
    result = await run(context, command.file, command.args, env);
  }
  if (result.code !== 0 && !command.optional) {
    throw new IpcError("unavailable", LABELS.commandFailed(commandLine(command), commandError(command.file, command.args, result)));
  }
  return result;
}

function statePath(context: CliContext): string {
  return join(context.runtime.userDataDir, SERVER.stateFile);
}

async function readState(context: CliContext): Promise<ServerState> {
  return parseServerState(await readFile(statePath(context), "utf8").catch(() => null));
}

async function writeState(context: CliContext, state: ServerState): Promise<void> {
  await mkdir(dirname(statePath(context)), { recursive: true });
  await writeFile(statePath(context), `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function currentUid(): number {
  return process.getuid?.() ?? 0;
}

function servicePlan(context: CliContext, command: readonly string[], bind: string, tailscale: string | null): HostServicePlan {
  return planHostService({
    platform: context.runtime.platform,
    home: context.runtime.paths.home,
    uid: currentUid(),
    command,
    bind,
    tailscale,
    env: context.env,
  });
}

function toolEnv(context: CliContext, tailscale: string | null): NodeJS.ProcessEnv {
  return { ...context.env, PATH: [servicePath(tailscale), context.env.PATH].filter(Boolean).join(":") };
}

async function tailscaleIp(context: CliContext, tailscale: string): Promise<string | null> {
  const result = await run(context, tailscale, ["ip", "-4"]);
  return result.code === 0 ? (result.stdout.split(/\r?\n/)[0]?.trim() || null) : null;
}

async function probeUrl(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(`${url}/v1/health`, { signal: AbortSignal.any([signal, AbortSignal.timeout(SERVER.hostShellPollMs * 4)]) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitHostShell(context: CliContext, url: string): Promise<boolean> {
  const deadline = Date.now() + SERVER.hostShellReadyMs;
  while (Date.now() < deadline && !context.signal.aborted) {
    if (await probeUrl(url, context.signal)) return true;
    await new Promise((resolve) => setTimeout(resolve, SERVER.hostShellPollMs));
  }
  return false;
}

async function imagePresent(context: CliContext, image: string): Promise<boolean> {
  return (await run(context, "docker", ["image", "inspect", "--format", "{{.Id}}", image])).code === 0;
}

function dockerProblem(report: DockerReport | null, platform: NodeJS.Platform): string | null {
  if (!report) return LABELS.unknown;
  if (isDockerReady(report, platform)) return null;
  const phase = phaseFromReport(report, platform);
  return phase.kind === "blocked" ? phase.reason : (report.daemonError ?? LABELS.unknown);
}

function previewEnv(envText: string): string[] {
  return envText
    .split("\n")
    .filter((line) => line && !/^DEV_(UID|GID)=/.test(line))
    .map((line) => {
      const [key] = line.split("=", 1);
      const secret = key === "TESSERACT_TOKEN" || key === "TS_AUTHKEY" || key === SERVER_ENV.claudeToken;
      return `  ${secret && !line.endsWith("=") ? `${key}=${REDACTED_VALUE}` : line}`;
    });
}

async function hostPairing(context: CliContext, command: readonly string[], tailscale: string | null): Promise<HostPairing> {
  const [file, ...args] = command;
  const result = await run(context, file as string, [...args, "host", "pair", "--json"], toolEnv(context, tailscale));
  if (result.code !== 0) throw new IpcError("unavailable", LABELS.hostPairFailed(commandError(file as string, args, result)));
  const line = result.stdout.split(/\r?\n/).find((text) => text.trim().startsWith("{"));
  if (!line) throw new IpcError("unavailable", LABELS.hostPairFailed(result.stdout.trim()));
  return JSON.parse(line) as HostPairing;
}

function describeHost(host: HostPairing, qr: boolean, color: boolean, controller: string): string[] {
  return [
    `${LABELS.hostHeading}: ${host.name} · ${host.url}`,
    "",
    host.link,
    ...(qr ? ["", ...renderQr(host.link, color), ""] : [""]),
    LABELS.hostScan,
    ...(host.pinSet ? [] : [LABELS.pinMissing(controller)]),
  ];
}

function requireController(context: CliContext): string[] {
  const command = controllerCommand(context.runtime.execPath, context.env, context.runtime.platform);
  if (!command) throw new IpcError("not_found", LABELS.noController(dirname(context.runtime.execPath), ENV.controllerCommand));
  return command;
}

async function install(context: CliContext): Promise<number> {
  const options = serverOptions(context);
  const { platform } = context.runtime;
  const sandbox = await context.runtime.sandboxContext();
  if (!options.dryRun) {
    const backup = migrateEnvFile(sandbox.envFile);
    if (backup) log(context, LEGACY_LABELS.envMigrated(sandbox.envFile, backup));
  }
  const report = await probeDocker({ env: context.env, signal: context.signal }).catch(() => null);
  const problem = dockerProblem(report, platform);
  if (problem && !options.dryRun) throw new IpcError("unavailable", LABELS.dockerNotReady(problem));

  const needsTailscale = options.hostShell || options.mode === "host-tailscale";
  const tailscale = needsTailscale ? resolveTailscale(context.env, platform) : null;
  if (needsTailscale && !tailscale && !options.dryRun) throw new IpcError("not_found", LABELS.noTailscale);
  const ip = tailscale ? await tailscaleIp(context, tailscale) : null;
  if (needsTailscale && !ip && !options.dryRun) throw new IpcError("unavailable", LABELS.noTailscaleIp);

  const base = await savedChoices(sandbox, defaultChoices(hostResources(), report));
  const choices = installChoices(base, options, ip);
  const existing = await readEnvValues(sandbox.envFile);
  const volumePrefix = existing?.TESSERACT_VOLUME_PREFIX || choices.project;
  if (!options.dryRun) {
    const target = { project: choices.project, volumePrefix, image: choices.image, env: context.env, hostEnv: context.env };
    await migrateLegacyStack({ run: runCommand }, target, (line) => log(context, line));
  }
  const volumeExists =
    choices.mode === "tailscale" && (await tailscaleVolumeExists({ run: runCommand }, context.env, volumePrefix));
  const issues = validateChoices(choices, { savedAuthKey: Boolean(existing?.TS_AUTHKEY), tailscaleVolumeExists: volumeExists });
  if (issues.length > 0) usageError(issues.map((issue) => `${issue.field}: ${issue.message}`).join("\n"));

  const command = options.hostShell ? controllerCommand(context.runtime.execPath, context.env, platform) : null;
  const bind = ip ?? "<tailscale-ip>";
  const plan = options.hostShell ? servicePlan(context, command ?? [join(dirname(context.runtime.execPath), CONTROLLER_BINARY)], bind, tailscale) : null;
  const present = await imagePresent(context, choices.image);
  const mode = imageMode(options, present);

  if (options.dryRun) {
    const redacted = { ...choices, tsAuthKey: choices.tsAuthKey ? REDACTED_VALUE : "" };
    const envText = renderEnvFile(redacted, { uid: 0, gid: 0 }, { token: REDACTED_VALUE, claudeOAuthToken: options.claudeToken ? REDACTED_VALUE : undefined });
    const lines = [
      LABELS.dryRun,
      ...(problem ? [LABELS.dockerNotReady(problem)] : []),
      LABELS.plannedEnv(sandbox.envFile),
      ...previewEnv(envText),
      LABELS.plannedImage(mode, choices.image),
      ...(plan
        ? [
            LABELS.plannedService(plan.kind, plan.file),
            ...plan.text.trimEnd().split("\n").map((line) => `    ${line}`),
            ...plan.install.map((step) => LABELS.plannedCommand(commandLine(step))),
            LABELS.plannedCommand(commandLine({ file: tailscale ?? SERVER.tailscaleBinary, args: tailscaleServeArgs(options.httpsPort, bind) })),
            ...(command ? [] : [LABELS.noController(dirname(context.runtime.execPath), ENV.controllerCommand)]),
            ...(tailscale ? [] : [LABELS.noTailscale]),
          ]
        : [LABELS.skippedHostShell]),
    ];
    emit(context, { dryRun: true, mode: options.mode, image: choices.image, imageMode: mode, envFile: sandbox.envFile, service: plan }, () => lines);
    return EXIT.ok;
  }

  const validation = {
    maxCpus: report?.server?.ncpu || undefined,
    memBytes: report?.server?.memBytes || undefined,
    tailscaleVolumeExists: volumeExists,
  };
  await writeStack(sandbox, choices, validation, { claudeOAuthToken: options.claudeToken ?? undefined });
  log(context, CLI_LABELS.sandbox.configured(sandbox.envFile));
  const built = await runStackBuild(context, sandbox, mode);
  if (built !== EXIT.ok) return built;

  if (!plan || !tailscale || !ip) {
    await writeState(context, { httpsPort: null, bind: null, serviceFile: null, tailscale });
    return printPairing(context, null, null);
  }
  const controller = command ?? requireController(context);
  const finalPlan = servicePlan(context, controller, ip, tailscale);
  log(context, LABELS.writing(finalPlan.file));
  await mkdir(dirname(finalPlan.file), { recursive: true });
  if (finalPlan.logDir) await mkdir(finalPlan.logDir, { recursive: true });
  await writeFile(finalPlan.file, finalPlan.text, { mode: 0o644 });
  for (const step of finalPlan.install) await runRequired(context, step);
  log(context, LABELS.serviceStarted(finalPlan.kind));
  await runRequired(context, { file: tailscale, args: tailscaleServeArgs(options.httpsPort, ip) });
  log(context, LABELS.serveAdded(options.httpsPort));
  await writeState(context, { httpsPort: options.httpsPort, bind: ip, serviceFile: finalPlan.file, tailscale });

  const hostUrl = `http://${ip}:${HOST_SHELL_PORT}`;
  if (await waitHostShell(context, hostUrl)) log(context, LABELS.hostShellReady(hostUrl));
  else log(context, LABELS.hostShellNotReady(hostUrl, finalPlan.logDir ?? `journalctl --user -u ${SERVER.systemdUnit}`));
  log(context, platform === "darwin" ? LABELS.autoLogin : LABELS.linger(context.env.USER || userInfo().username));
  return printPairing(context, controller, tailscale);
}

async function printPairing(context: CliContext, controller: readonly string[] | null, tailscale: string | null): Promise<number> {
  let sandbox: PairingInfo | null = null;
  let host: HostPairing | null = null;
  const errors: string[] = [];
  try {
    sandbox = await resolvePairingInfo(context);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  if (controller) {
    try {
      host = await hostPairing(context, controller, tailscale);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  const qr = !context.flags.has("no-qr");
  const color = Boolean(context.io.color);
  const controllerName = controller ? controller.join(" ") : "tesseract-controller";
  emit(context, { sandbox, host, errors }, () => [
    ...(host && !host.pinSet ? [LABELS.nextSteps, LABELS.setPin(controllerName), ""] : []),
    `${LABELS.sandboxHeading}:`,
    ...(sandbox ? describePairing(sandbox, { qr, color }) : []),
    "",
    ...(host ? describeHost(host, qr, color, controllerName) : []),
    ...errors,
  ]);
  return errors.length > 0 && !sandbox && !host ? EXIT.error : EXIT.ok;
}

async function pair(context: CliContext): Promise<number> {
  const state = await readState(context);
  const tailscale = state.tailscale ?? resolveTailscale(context.env, context.runtime.platform);
  const controller = controllerCommand(context.runtime.execPath, context.env, context.runtime.platform);
  return printPairing(context, controller, tailscale);
}

async function stackStatus(sandbox: SandboxContext): Promise<SandboxStackStatus | null> {
  return composeStatus(sandbox).catch(() => null);
}

async function status(context: CliContext): Promise<number> {
  const state = await readState(context);
  const sandbox = await context.runtime.sandboxContext();
  const stack = await stackStatus(sandbox);
  const tailscale = state.tailscale ?? resolveTailscale(context.env, context.runtime.platform);
  const plan = servicePlan(context, [], state.bind ?? "", tailscale);
  const service = state.serviceFile ? (await run(context, plan.status.file, plan.status.args)).code === 0 : null;
  const httpsPort = state.httpsPort ?? SERVER.defaultHttpsPort;
  const serveJson = tailscale ? await run(context, tailscale, ["serve", "status", "--json"]) : null;
  const serve = serveJson && serveJson.code === 0 ? serveEntry(serveJson.stdout, httpsPort) : null;
  const values = await readEnvValues(sandbox.envFile);
  const endpoint = values ? stackEndpoint(values, context.env) : null;
  const sandboxUrl = endpoint ? await firstHealthy({ fetch }, endpoint.candidates, context.signal) : null;
  const hostUrl = state.bind ? `http://${state.bind}:${HOST_SHELL_PORT}` : null;
  const hostHealthy = hostUrl ? await probeUrl(hostUrl, context.signal) : null;
  const value = {
    stack,
    service: { kind: plan.kind, file: state.serviceFile, running: service },
    serve,
    sandbox: { url: sandboxUrl ?? endpoint?.candidates[0] ?? null, healthy: sandboxUrl !== null },
    host: { url: hostUrl, healthy: hostHealthy },
  };
  const rows = LABELS.statusRows;
  emit(context, value, () => [
    ...table([
      [`${rows.stack}:`, stack ? `${stack.project} · ${stack.services.length} container(s)` : LABELS.notInstalled],
      [`${rows.service}:`, service === null ? LABELS.notInstalled : service ? LABELS.running : LABELS.stopped],
      [`${rows.serve}:`, serve ?? LABELS.notInstalled],
      [`${rows.sandboxHealth}:`, value.sandbox.url ? (value.sandbox.healthy ? LABELS.healthy(value.sandbox.url) : LABELS.unhealthy(value.sandbox.url)) : LABELS.notInstalled],
      [`${rows.hostHealth}:`, hostUrl ? (hostHealthy ? LABELS.healthy(hostUrl) : LABELS.unhealthy(hostUrl)) : LABELS.notInstalled],
    ]),
    ...(stack && stack.services.length > 0 ? ["", ...describeServices(stack)] : []),
  ]);
  return EXIT.ok;
}

async function uninstall(context: CliContext): Promise<number> {
  const state = await readState(context);
  const tailscale = state.tailscale ?? resolveTailscale(context.env, context.runtime.platform);
  const plan = servicePlan(context, [], state.bind ?? "", tailscale);
  for (const step of plan.uninstall) await runRequired(context, step);
  const serviceFile = state.serviceFile ?? plan.file;
  await rm(serviceFile, { force: true });
  log(context, LABELS.serviceRemoved(serviceFile));
  if (tailscale) {
    const port = state.httpsPort ?? SERVER.defaultHttpsPort;
    const off = await run(context, tailscale, tailscaleServeOffArgs(port));
    if (off.code === 0) log(context, LABELS.serveRemoved(port));
  }
  const sandbox = await context.runtime.sandboxContext();
  log(context, CLI_LABELS.sandbox.down);
  const stack = (await readEnvValues(sandbox.envFile))
    ? await composeDown(sandbox, context.flags.has("volumes"), { onLog: (line) => log(context, line) })
    : null;
  await rm(statePath(context), { force: true });
  emit(context, { stack, serviceFile }, () => (stack ? describeServices(stack) : []));
  return EXIT.ok;
}

type Action = (context: CliContext) => Promise<number>;

export const SERVER_ACTIONS: Record<string, Action> = { install, uninstall, status, pair };

export default defineCommand({
  name: "server",
  trigger: { subcommand: "server" },
  summary: CLI_LABELS.summary.server,
  usage: CLI_LABELS.usageLines.server,
  flags: ["build", "no-host-shell", "dry-run", "volumes", "no-qr"],
  valueFlags: ["mode", "hostname", "tailnet-domain", "authkey", "with", "image", "claude-token", "host-https-port"],
  run: (context) =>
    guarded(context, async () => {
      const name = context.args[0] ?? "status";
      const action = SERVER_ACTIONS[name];
      if (!action) usageError(CLI_LABELS.unknownSubcommand("server", name));
      return action(context);
    }),
});
