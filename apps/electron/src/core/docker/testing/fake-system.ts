import type { CommandResult } from "../../process";
import type { DockerSystem } from "../system";

export type FakeReply = Partial<CommandResult> | ((args: readonly string[]) => Partial<CommandResult>);

export interface FakeSystemOptions {
  commands?: Record<string, FakeReply>;
  binaries?: Record<string, string>;
  files?: Record<string, string>;
  paths?: string[];
  socketGid?: number | null;
  fetch?: typeof fetch;
}

export interface FakeSystem extends DockerSystem {
  calls: string[];
  launched: string[];
  clock: { now: number };
  set(command: string, reply: FakeReply): void;
}

function basename(file: string): string {
  return file.split(/[\\/]/).pop() ?? file;
}

function result(reply: Partial<CommandResult>): CommandResult {
  return { code: 0, stdout: "", stderr: "", timedOut: false, ...reply };
}

export function fakeSystem(options: FakeSystemOptions = {}): FakeSystem {
  const commands: Record<string, FakeReply> = { ...options.commands };
  const calls: string[] = [];
  const launched: string[] = [];
  const clock = { now: 1_000_000 };
  const lookup = (file: string, args: readonly string[]): CommandResult => {
    const name = basename(file).replace(/\.exe$/i, "");
    const line = [name, ...args].join(" ");
    calls.push(line);
    const key = Object.keys(commands)
      .filter((candidate) => line === candidate || line.startsWith(`${candidate} `))
      .sort((a, b) => b.length - a.length)[0];
    if (key === undefined) return result({ code: 127, stderr: `${name}: not found` });
    const reply = commands[key];
    return result(typeof reply === "function" ? reply(args) : (reply ?? {}));
  };
  return {
    calls,
    launched,
    clock,
    set: (command, reply) => {
      commands[command] = reply;
    },
    run: async (file, args) => lookup(file, args),
    stream: async (file, args, streamOptions) => {
      const reply = lookup(file, args);
      for (const line of `${reply.stdout}\n${reply.stderr}`.split("\n")) if (line.trim()) streamOptions?.onLine?.(line);
      return reply;
    },
    launch: (file, args) => {
      launched.push([basename(file), ...args].join(" "));
    },
    which: (name) => options.binaries?.[name] ?? null,
    exists: (path) => (options.paths ?? []).includes(path) || path in (options.files ?? {}),
    readText: async (path) => options.files?.[path] ?? null,
    socketGid: () => options.socketGid ?? null,
    fetch: options.fetch ?? (async () => new Response("", { status: 404 })),
    sleep: async (ms) => {
      clock.now += ms;
    },
    now: () => clock.now,
  };
}
