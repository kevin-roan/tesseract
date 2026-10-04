import { parseArgs } from "node:util";
import { renderANSI } from "uqr";
import { buildPairingLink, HOST_PAIRING_ACTION, HOST_PIN_PATTERN } from "@theone/protocol";
import { CliError } from "../cli/local-api";
import type { Output } from "../cli/output";
import type { Env } from "../core/exec";
import { HELPER_COMMAND, runEmulatorHelper } from "./android/netns-helper";
import { HostConfigError, loadHostConfig, tailscaleServeUrl } from "./config";
import { startHostShell } from "./server";
import { HostStateStore } from "./state";

export const HOST_USAGE = `  theone-controller host serve [--bind <ipv4>] [--port <n>]
                                     run the host shell daemon (on the host, not in the sandbox) on the
                                     host's Tailscale IPv4 (or loopback); phones need the host token and the PIN
                                     also drives the host Android emulator (THEONE_ANDROID_SDK_ROOT, THEONE_ADB,
                                     THEONE_SCRCPY_SERVER, THEONE_SCRCPY_VERSION, THEONE_FFMPEG,
                                     THEONE_EMULATOR_PORT, THEONE_EMULATOR_GPU, THEONE_EMULATOR_ISOLATION,
                                     THEONE_EMULATOR_ALLOW_NETS, THEONE_EMULATOR_ADB_PORT)
  theone-controller host pin [--stdin]
                                     set the host shell PIN (6-12 digits); ends every open session
  theone-controller host pair [--json]
                                     print the host shell pairing link (theone://host) and a QR code;
                                     --json prints { link, url, name, pinSet }
  theone-controller host token [--rotate]
                                     print the host token, or replace it (paired phones must pair again)`;

export type HostCliIo = {
  env: Env;
  output: Output;
  readStdin: () => Promise<string>;
  readSecret?: (prompt: string) => Promise<string>;
};

const CTRL_C = "\u0003";
const BACKSPACE = new Set(["\u007f", "\b"]);
const ENTER = new Set(["\r", "\n"]);

/** Reads one line from the TTY in raw mode so the PIN is never echoed. */
export function readHiddenLine(prompt: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) return Promise.reject(new CliError("No terminal to read the PIN from; use --stdin", 2));
  process.stderr.write(prompt);
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stderr.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString("utf8")) {
        if (char === CTRL_C) return finish(new CliError("Interrupted", 130));
        if (ENTER.has(char)) return finish();
        if (BACKSPACE.has(char)) value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

function config(env: Env, overrides: { bind?: string; port?: string } = {}, resolveBind = true) {
  try {
    return loadHostConfig(env, overrides, resolveBind);
  } catch (error) {
    if (error instanceof HostConfigError) throw new CliError(error.message, 2);
    throw error;
  }
}

function serve(args: string[], io: HostCliIo): null {
  const { values } = parseArgs({ args, options: { bind: { type: "string" }, port: { type: "string" } }, strict: true });
  const shell = startHostShell(config(io.env, values));
  const shutdown = () => void shell.stop().finally(() => process.exit(0));
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  return null;
}

async function pin(args: string[], io: HostCliIo): Promise<number> {
  const { values } = parseArgs({ args, options: { stdin: { type: "boolean", default: false } }, strict: true });
  let value: string;
  if (values.stdin) {
    value = (await io.readStdin()).trim();
  } else {
    const read = io.readSecret ?? readHiddenLine;
    value = await read("New host shell PIN (6-12 digits): ");
    if (!HOST_PIN_PATTERN.test(value)) throw new CliError("The PIN must be 6 to 12 digits", 2);
    if ((await read("Repeat the PIN: ")) !== value) throw new CliError("The PINs do not match", 2);
  }
  if (!HOST_PIN_PATTERN.test(value)) throw new CliError("The PIN must be 6 to 12 digits", 2);
  const settings = config(io.env, {}, false);
  await new HostStateStore(settings.stateDir, settings.stateFile).setPin(value);
  io.output.out(`PIN saved to ${settings.stateFile}; phones must unlock with the new PIN.`);
  return 0;
}

function pair(args: string[], io: HostCliIo): number {
  const { values } = parseArgs({ args, options: { json: { type: "boolean", default: false } }, strict: true });
  const settings = config(io.env, {}, !io.env.THEONE_HOST_SHELL_PUBLIC_URL);
  // iOS refuses plain http to the Tailscale IP, so prefer the HTTPS name `tailscale serve` gives this daemon.
  const url = io.env.THEONE_HOST_SHELL_PUBLIC_URL ? settings.publicUrl : (tailscaleServeUrl(settings.bind, settings.port) ?? settings.publicUrl);
  const store = new HostStateStore(settings.stateDir, settings.stateFile);
  const token = store.ensureToken();
  const link = buildPairingLink({ url, token, name: settings.hostId }, HOST_PAIRING_ACTION);
  const pinSet = store.read().pinHash !== null;
  if (values.json) {
    io.output.out(JSON.stringify({ link, url, name: settings.hostId, pinSet }));
  } else {
    io.output.out(renderANSI(link, { ecc: "L", border: 2 }));
    io.output.out(`Scan with the TheOne app (Host shell), or open this link on the phone:\n\n  ${link}\n`);
    io.output.out(`Host ${settings.hostId} · ${url}`);
    io.output.err("The link contains the host token: share it only with your own devices.");
  }
  if (!pinSet) io.output.err("warning: no PIN is set yet; run theone-controller host pin");
  return 0;
}

function token(args: string[], io: HostCliIo): number {
  const { values } = parseArgs({ args, options: { rotate: { type: "boolean", default: false } }, strict: true });
  const settings = config(io.env, {}, false);
  const store = new HostStateStore(settings.stateDir, settings.stateFile);
  if (!values.rotate) {
    io.output.out(store.ensureToken());
    return 0;
  }
  store.rotateToken();
  io.output.out(`Wrote a new host token to ${settings.stateFile}; phones must pair again.`);
  io.output.out("Pair them with theone-controller host pair.");
  return 0;
}

/** Returns the exit code, or null while the daemon runs. */
export async function hostCli(args: string[], io: HostCliIo): Promise<number | null> {
  const [command, ...rest] = args;
  switch (command) {
    case "serve":
      return serve(rest, io);
    case "pin":
      return await pin(rest, io);
    case "pair":
      return pair(rest, io);
    case "token":
      return token(rest, io);
    case HELPER_COMMAND:
      try {
        return await runEmulatorHelper(rest);
      } catch (error) {
        throw new CliError(error instanceof Error ? error.message : String(error), 2);
      }
    default:
      throw new CliError(`Unknown host command "${command ?? ""}"; expected serve, pin, pair or token`, 2);
  }
}
