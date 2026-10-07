import { spawn } from "node:child_process";
import { posix, win32 } from "node:path";
import type { Platform } from "../../shared/runtime";
import { CLI_NAME } from "../../shared/runtime";
import { CLI_DEV_ENTRY, CLI_DEV_RUNNER, LOCAL_COMMAND_EXIT } from "../constants";
import { LOCAL_COMMAND_LABELS } from "../labels";

export interface LocalCommandEnvironment {
  platform: Platform;
  packaged: boolean;
  resourcesPath: string;
  appPath: string;
}

export interface Invocation {
  file: string;
  args: string[];
}

export function localCommandInvocation(env: LocalCommandEnvironment, args: readonly string[]): Invocation {
  if (env.packaged) {
    const path = env.platform === "win32" ? win32 : posix;
    const file = path.join(env.resourcesPath, "bin", env.platform === "win32" ? `${CLI_NAME}.exe` : CLI_NAME);
    return { file, args: [...args] };
  }
  return { file: CLI_DEV_RUNNER, args: [posix.join(env.appPath, ...CLI_DEV_ENTRY), ...args] };
}

export function runLocalCommand(invocation: Invocation): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(invocation.file, invocation.args, { stdio: "inherit", cwd: process.cwd(), env: process.env, windowsHide: true });
    child.once("error", (error) => {
      process.stderr.write(`${LOCAL_COMMAND_LABELS.failed(invocation.file, error.message)}\n`);
      resolve(LOCAL_COMMAND_EXIT.error);
    });
    child.once("exit", (code, signal) => resolve(code ?? (signal ? LOCAL_COMMAND_EXIT.interrupted : LOCAL_COMMAND_EXIT.error)));
  });
}
