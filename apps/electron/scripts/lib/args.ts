export interface ParsedArgs {
  flags: Set<string>;
  values: Map<string, string>;
  positional: string[];
}

export function parseArgs(argv: readonly string[], valueFlags: readonly string[]): ParsedArgs {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--") continue;
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const [name, inline] = arg.slice(2).split("=", 2) as [string, string | undefined];
    if (valueFlags.includes(name)) {
      const value = inline ?? argv[index + 1];
      if (inline === undefined) index += 1;
      if (value === undefined) throw new Error(`--${name} needs a value`);
      values.set(name, value);
    } else {
      flags.add(name);
    }
  }
  return { flags, values, positional };
}
