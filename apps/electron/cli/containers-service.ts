import { ContainersService, stateFileIn } from "../src/core/containers";
import { stateDir } from "../src/core/paths";
import { runCommand } from "../src/core/process";
import { streamCommand } from "../src/core/sandbox/spawn";
import { log } from "./io";
import type { CliContext } from "./types";

export function containersService(context: CliContext): ContainersService {
  return new ContainersService({
    docker: {
      run: (file, args, options = {}) => runCommand(file, args, { timeoutMs: options.timeoutMs, input: options.input, env: { ...context.env, ...options.extraEnv } }),
      stream: (file, args, options = {}) => streamCommand(file, args, { ...options, env: context.env, signal: options.signal ?? context.signal }),
      log: (line) => {
        if (context.verbose) log(context, line);
      },
    },
    configFile: context.runtime.configFile,
    stateFile: stateFileIn(stateDir(context.runtime.paths)),
    contextDir: context.runtime.sandboxContextDir(),
    env: context.env,
    cipher: null,
    seal: false,
  });
}

export async function readStdinSecret(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").trim();
}
