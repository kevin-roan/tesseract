import { SHORT_FLAGS } from "./constants";

export interface ParsedArgs {
  flags: Set<string>;
  values: Map<string, string>;
  positional: string[];
}

export function parseArgs(argv: readonly string[], valueFlags: readonly string[]): ParsedArgs {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const positional: string[] = [];
  let rest = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (rest || arg === "-" || !arg.startsWith("-")) {
      positional.push(arg);
      continue;
    }
    if (arg === "--") {
      rest = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      for (const letter of arg.slice(1)) flags.add(SHORT_FLAGS[letter] ?? letter);
      continue;
    }
    const body = arg.slice(2);
    const equals = body.indexOf("=");
    const name = equals === -1 ? body : body.slice(0, equals);
    const inline = equals === -1 ? undefined : body.slice(equals + 1);
    if (valueFlags.includes(name)) {
      values.set(name, inline ?? argv[(index += 1)] ?? "");
    } else {
      flags.add(name);
    }
  }
  return { flags, values, positional };
}

export function firstSubcommand(argv: readonly string[]): string | null {
  for (const arg of argv) {
    if (arg === "--") return null;
    if (!arg.startsWith("-")) return arg;
  }
  return null;
}

export function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function positiveInt(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number.parseInt(value, 10);
  return parsed > 0 ? parsed : null;
}
