import { migrateLegacyInstall } from "../src/core/legacy";
import { firstSubcommand, parseArgs } from "./args";
import { GLOBAL_FLAGS } from "./constants";
import { commandHelp, generalHelp } from "./help";
import { processIo } from "./io";
import { CLI_LABELS } from "./labels";
import { COMMANDS, findCommand } from "./registry";
import { createRuntime, currentRuntimeInput, type CliRuntime } from "./runtime";
import { EXIT, type CliCommand, type CliContext, type CliIo } from "./types";

export interface MainOptions {
  io?: CliIo;
  runtime?: CliRuntime;
  signal?: AbortSignal;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

const FLAG_COMMANDS = COMMANDS.filter((command) => "flag" in command.trigger);

function print(io: CliIo, lines: readonly string[]): number {
  for (const line of lines) io.stdout(line);
  return EXIT.ok;
}

function usageFailure(io: CliIo, json: boolean, message: string): number {
  if (json) io.stdout(JSON.stringify({ ok: false, error: { code: "invalid_argument", message } }, null, 2));
  else io.stderr(message);
  return EXIT.usage;
}

function flagCommand(argv: readonly string[]): CliCommand | null {
  const { flags } = parseArgs(argv, []);
  return FLAG_COMMANDS.find((command) => "flag" in command.trigger && flags.has(command.trigger.flag)) ?? null;
}

function allowedFlags(command: CliCommand): Set<string> {
  return new Set<string>([
    ...GLOBAL_FLAGS,
    ...(command.flags ?? []),
    ...(command.valueFlags ?? []),
    ...("flag" in command.trigger ? [command.trigger.flag] : []),
  ]);
}

export async function main(argv: string[], options: MainOptions = {}): Promise<number> {
  const io = options.io ?? processIo;
  const json = argv.includes("--json");
  const subcommand = firstSubcommand(argv);
  if (subcommand === "help") {
    const target = argv.filter((arg) => !arg.startsWith("-"))[1];
    const command = target ? findCommand(target) : null;
    if (target && !command) return usageFailure(io, json, CLI_LABELS.unknown(target));
    return print(io, command ? commandHelp(command) : generalHelp(COMMANDS));
  }
  const command = subcommand ? findCommand(subcommand) : flagCommand(argv);
  if (!command || (subcommand && "flag" in command.trigger)) {
    if (!subcommand && argv.every((arg) => GLOBAL_FLAGS.includes(arg.replace(/^--/, "") as (typeof GLOBAL_FLAGS)[number]))) {
      return print(io, generalHelp(COMMANDS));
    }
    const offender = subcommand ?? argv.find((arg) => arg.startsWith("-")) ?? "";
    return usageFailure(io, json, CLI_LABELS.unknown(offender));
  }
  const { flags, values, positional } = parseArgs(argv, command.valueFlags ?? []);
  if (flags.has("help")) return print(io, commandHelp(command));
  const allowed = allowedFlags(command);
  const unknown = [...flags, ...values.keys()].find((flag) => !allowed.has(flag));
  if (unknown) return usageFailure(io, json, CLI_LABELS.unknown(`--${unknown}`));
  const context: CliContext = {
    argv,
    args: subcommand ? positional.slice(1) : positional,
    flags,
    values,
    json,
    verbose: flags.has("verbose"),
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
    io,
    runtime: options.runtime ?? installedRuntime(io),
    signal: options.signal ?? new AbortController().signal,
  };
  return command.run(context);
}

function installedRuntime(io: CliIo): CliRuntime {
  const runtime = createRuntime(currentRuntimeInput());
  try {
    migrateLegacyInstall(runtime.paths).messages.forEach((line) => io.stderr(line));
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
  }
  return runtime;
}

function interruptSignal(): AbortSignal {
  const controller = new AbortController();
  process.on("SIGINT", () => {
    if (controller.signal.aborted) process.exit(EXIT.interrupted);
    controller.abort();
  });
  return controller.signal;
}

if (import.meta.main) {
  main(process.argv.slice(2), { signal: interruptSignal() }).then(
    (code) => process.exit(code),
    (error: unknown) => {
      processIo.stderr(CLI_LABELS.failed(error instanceof Error ? error.message : String(error)));
      process.exit(EXIT.error);
    },
  );
}
