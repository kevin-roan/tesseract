import { parseArgs } from "node:util";
import { renderANSI } from "uqr";
import { buildPairingLink, HOST_PAIRING_ACTION, HOST_PIN_PATTERN, parseJsonWith, UpdateAndroidStreamSchema } from "@tesseract/protocol";
import { CliError } from "../cli/local-api";
import type { Output } from "../cli/output";
import type { Env } from "../core/exec";
import { emulatorSerial } from "./android/config";
import { listAdbDevices } from "./android/devices";
import { HELPER_COMMAND, runEmulatorHelper } from "./android/netns-helper";
import { HostConfigError, loadHostConfig, tailscaleServeUrl } from "./config";
import { startHostShell } from "./server";
import { HostStateStore } from "./state";

export const HOST_USAGE = `  tesseract-controller host serve [--bind <ipv4>] [--port <n>]
                                     run the host shell daemon (on the host, not in the sandbox) on the
                                     host's Tailscale IPv4 (or loopback); phones need the host token and the PIN
                                     also drives the host Android emulator (TESSERACT_ANDROID_SDK_ROOT, TESSERACT_ADB,
                                     TESSERACT_SCRCPY_SERVER, TESSERACT_SCRCPY_VERSION, TESSERACT_FFMPEG,
                                     TESSERACT_EMULATOR_PORT, TESSERACT_EMULATOR_GPU, TESSERACT_EMULATOR_ISOLATION,
                                     TESSERACT_EMULATOR_ALLOW_NETS, TESSERACT_EMULATOR_ADB_PORT,
                                     TESSERACT_ANDROID_SHARE_EMULATORS=on to tunnel the host's other emulators too)
  tesseract-controller host pin [--stdin]
                                     set the host shell PIN (6-12 digits); ends every open session
  tesseract-controller host pair [--json]
                                     print the host shell pairing link (tesseract://host) and a QR code;
                                     --json prints { link, url, name, pinSet }
  tesseract-controller host token [--rotate]
                                     print the host token, or replace it (paired phones must pair again)
  tesseract-controller host stream [--json] [--stdin]
                                     print the Android screen stream settings and the adb devices;
                                     --stdin reads a JSON object of settings to change first;
                                     --json prints { stream, devices }`;

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
  const settings = config(io.env, {}, !io.env.TESSERACT_HOST_SHELL_PUBLIC_URL);
  // iOS refuses plain http to the Tailscale IP, so prefer the HTTPS name `tailscale serve` gives this daemon.
  const url = io.env.TESSERACT_HOST_SHELL_PUBLIC_URL ? settings.publicUrl : (tailscaleServeUrl(settings.bind, settings.port, io.env) ?? settings.publicUrl);
  const store = new HostStateStore(settings.stateDir, settings.stateFile);
  const token = store.ensureToken();
  const link = buildPairingLink({ url, token, name: settings.hostId }, HOST_PAIRING_ACTION);
  const pinSet = store.read().pinHash !== null;
  if (values.json) {
    io.output.out(JSON.stringify({ link, url, name: settings.hostId, pinSet }));
  } else {
    io.output.out(renderANSI(link, { ecc: "L", border: 2 }));
    io.output.out(`Scan with the Tesseract app (Host shell), or open this link on the phone:\n\n  ${link}\n`);
    io.output.out(`Host ${settings.hostId} · ${url}`);
    io.output.err("The link contains the host token: share it only with your own devices.");
  }
  if (!pinSet) io.output.err("warning: no PIN is set yet; run tesseract-controller host pin");
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
  io.output.out("Pair them with tesseract-controller host pair.");
  return 0;
}

async function stream(args: string[], io: HostCliIo): Promise<number> {
  const { values } = parseArgs({ args, options: { json: { type: "boolean", default: false }, stdin: { type: "boolean", default: false } }, strict: true });
  const settings = config(io.env, {}, false);
  const store = new HostStateStore(settings.stateDir, settings.stateFile);
  if (values.stdin) {
    const parsed = parseJsonWith(UpdateAndroidStreamSchema, await io.readStdin());
    if (!parsed.ok) throw new CliError(`Invalid stream settings: ${parsed.error.message}`, 2);
    store.updateAndroidStream(parsed.value);
  }
  const current = store.androidStreamSettings();
  const devices = await listAdbDevices(settings.android, emulatorSerial(settings.android));
  if (values.json) {
    io.output.out(JSON.stringify({ stream: current, devices }));
    return 0;
  }
  for (const [key, value] of Object.entries(current)) io.output.out(`${key}: ${value ?? "-"}`);
  io.output.out(devices.length ? "\ndevices:" : "\nno adb devices");
  for (const device of devices) io.output.out(`  ${device.serial}  ${device.state}  ${device.kind}  ${device.model ?? ""}`);
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
    case "stream":
      return await stream(rest, io);
    case HELPER_COMMAND:
      try {
        return await runEmulatorHelper(rest);
      } catch (error) {
        throw new CliError(error instanceof Error ? error.message : String(error), 2);
      }
    default:
      throw new CliError(`Unknown host command "${command ?? ""}"; expected serve, pin, pair, token or stream`, 2);
  }
}
