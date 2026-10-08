import type { ToolVersion } from "@tesseract/protocol";
import { resolveExecutable, run } from "../core/exec";

export type ToolProbe = { name: string; bin: string; args: string[] };

const PROBE_TIMEOUT_MS = 3_000;
const VERSION_PATTERN = /\d+(?:\.\d+)+(?:-[0-9A-Za-z.]+)?/;

export function extractVersion(output: string): string | null {
  for (const line of output.split("\n")) {
    const match = VERSION_PATTERN.exec(line);
    if (match) return match[0];
  }
  return null;
}

export function defaultProbes(claudeBin: string): ToolProbe[] {
  return [
    { name: "node", bin: "node", args: ["--version"] },
    { name: "bun", bin: "bun", args: ["--version"] },
    { name: "git", bin: "git", args: ["--version"] },
    { name: "python3", bin: "python3", args: ["--version"] },
    { name: "java", bin: "java", args: ["-version"] },
    { name: "wine", bin: "wine", args: ["--version"] },
    { name: "claude", bin: claudeBin, args: ["--version"] },
    { name: "adb", bin: "adb", args: ["--version"] },
  ];
}

async function probe(tool: ToolProbe): Promise<ToolVersion> {
  const executable = resolveExecutable(tool.bin);
  if (!executable) return { name: tool.name, version: null };
  const result = await run([executable, ...tool.args], { timeoutMs: PROBE_TIMEOUT_MS });
  if (result.timedOut || result.error) return { name: tool.name, version: null };
  return { name: tool.name, version: extractVersion(`${result.stdout}\n${result.stderr}`) };
}

export class ToolService {
  private readonly detected: Promise<ToolVersion[]>;

  constructor(probes: ToolProbe[]) {
    this.detected = Promise.all(probes.map(probe));
  }

  list(): Promise<ToolVersion[]> {
    return this.detected;
  }

  async has(name: string): Promise<boolean> {
    const tools = await this.detected;
    return tools.some((tool) => tool.name === name && tool.version !== null);
  }
}
