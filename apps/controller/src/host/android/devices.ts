import type { AndroidDevice, AndroidDeviceKind } from "@theone/protocol";
import { run } from "../../core/exec";
import { sdkEnv, type AndroidConfig } from "./config";

const COMMAND_TIMEOUT_MS = 5_000;
const GENYMOTION = /vbox86|genymotion/i;
const NETWORK = /:\d+$|\._adb-tls-connect\._tcp/;
const LOOPBACK = /^(127\.\d+\.\d+\.\d+|localhost):\d+$/;

function deviceKind(serial: string, fields: Record<string, string>): AndroidDeviceKind {
  if (GENYMOTION.test(fields.product ?? "") || GENYMOTION.test(fields.device ?? "") || GENYMOTION.test(fields.model ?? "")) return "genymotion";
  if (serial.startsWith("emulator-") || LOOPBACK.test(serial)) return "emulator";
  return NETWORK.test(serial) ? "network" : "usb";
}

/** `adb devices -l` → devices; `hostSerial` is the adb serial of the emulator the daemon drives. */
export function parseAdbDevices(output: string, hostSerial: string): AndroidDevice[] {
  const devices: AndroidDevice[] = [];
  for (const line of output.split("\n")) {
    const [serial, state, ...rest] = line.trim().split(/\s+/);
    if (!serial || !state || serial === "List" || serial.startsWith("*")) continue;
    const fields = Object.fromEntries(rest.map((field) => field.split(":", 2)).filter((pair) => pair.length === 2));
    const hostEmulator = serial === hostSerial;
    devices.push({
      serial,
      state,
      kind: hostEmulator ? "emulator" : deviceKind(serial, fields),
      model: fields.model?.replaceAll("_", " ") ?? null,
      hostEmulator,
    });
  }
  return devices;
}

export async function listAdbDevices(config: AndroidConfig, hostSerial: string): Promise<AndroidDevice[]> {
  if (!config.adb) return [];
  const result = await run([config.adb, "devices", "-l"], { env: sdkEnv(config), timeoutMs: COMMAND_TIMEOUT_MS });
  return result.ok ? parseAdbDevices(result.stdout, hostSerial) : [];
}
