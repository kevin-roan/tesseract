import type { CliRuntime } from "./runtime";

export interface CliIo {
  stdout(line: string): void;
  stderr(line: string): void;
  progress?(line: string | null): void;
  color?: boolean;
}

export interface CliContext {
  argv: string[];
  args: string[];
  flags: Set<string>;
  values: Map<string, string>;
  json: boolean;
  verbose: boolean;
  cwd: string;
  env: NodeJS.ProcessEnv;
  io: CliIo;
  runtime: CliRuntime;
  signal: AbortSignal;
}

export interface CliCommand {
  name: string;
  trigger: { flag: string } | { subcommand: string };
  summary: string;
  usage?: readonly string[];
  flags?: readonly string[];
  valueFlags?: readonly string[];
  hidden?: boolean;
  run(context: CliContext): Promise<number>;
}

export const EXIT = { ok: 0, error: 1, conflict: 2, usage: 64, interrupted: 130 } as const;

export function defineCommand(command: CliCommand): CliCommand {
  return command;
}

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}
