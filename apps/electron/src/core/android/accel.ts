import { constants as fsConstants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import type { AccelCheck, AccelResult } from "../../shared/contracts/android";
import type { PathEnvironment } from "../paths";
import { runCommand, type CommandResult } from "../process";
import {
  ACCEL_CHECK_TIMEOUT_MS,
  ACCEL_HINT_CODES,
  CPUINFO,
  HVF_PROBE,
  ISOLATION_PROBE,
  KVM_DEVICE,
  PROBE_TIMEOUT_MS,
  WHPX_ENABLED,
  WHPX_PROBE,
} from "./constants";
import { ANDROID_LABELS } from "./labels";
import { emulatorBinary, exists, sdkEnv } from "./sdk";

const LABELS = ANDROID_LABELS.accel;

export type CommandRunner = (file: string, args: readonly string[], options: { timeoutMs: number; env?: NodeJS.ProcessEnv }) => Promise<CommandResult>;

export interface AccelProbes {
  run: CommandRunner;
  exists(path: string): Promise<boolean>;
  canReadWrite(path: string): Promise<boolean>;
  readText(path: string): Promise<string | null>;
}

export const defaultProbes: AccelProbes = {
  run: (file, args, options) => runCommand(file, args, options),
  exists,
  canReadWrite: async (path) => {
    try {
      await access(path, fsConstants.R_OK | fsConstants.W_OK);
      return true;
    } catch {
      return false;
    }
  },
  readText: async (path) => {
    try {
      return await readFile(path, "utf8");
    } catch {
      return null;
    }
  },
};

export interface EmulatorAccel {
  code: number;
  message: string;
}

export function parseAccelCheck(output: string): EmulatorAccel | null {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const start = lines.findIndex((line) => line === "accel:");
  if (start === -1) return null;
  const code = Number(lines[start + 1]);
  if (!Number.isInteger(code)) return null;
  const end = lines.indexOf("accel", start + 2);
  const message = lines.slice(start + 2, end === -1 ? undefined : end).join(" ");
  return { code, message };
}

export function accelHint(code: number): string | null {
  for (const [key, codes] of Object.entries(ACCEL_HINT_CODES) as [keyof typeof ACCEL_HINT_CODES, readonly number[]][]) {
    if (codes.includes(code)) return LABELS.hints[key];
  }
  return null;
}

export function kvmModule(cpuinfo: string | null): string {
  return /vendor_id\s*:\s*AuthenticAMD/.test(cpuinfo ?? "") ? "kvm_amd" : "kvm_intel";
}

function check(id: string, status: AccelCheck["status"], title: string, detail: string, action?: AccelCheck["action"]): AccelCheck {
  return action ? { id, status, title, detail, action } : { id, status, title, detail };
}

async function linuxChecks(probes: AccelProbes): Promise<AccelCheck[]> {
  const checks: AccelCheck[] = [];
  if (!(await probes.exists(KVM_DEVICE))) {
    const module = kvmModule(await probes.readText(CPUINFO));
    checks.push(check("kvm", "error", LABELS.kvmTitle, `${LABELS.kvmMissing}\n${LABELS.kvmModprobe(module)}`, "accel-docs"));
  } else {
    checks.push(check("kvm", "ok", LABELS.kvmTitle, LABELS.kvmOk));
    checks.push(
      (await probes.canReadWrite(KVM_DEVICE))
        ? check("kvm-access", "ok", LABELS.kvmAccessTitle, LABELS.kvmAccessOk)
        : check("kvm-access", "warning", LABELS.kvmAccessTitle, `${LABELS.kvmAccess}\n${LABELS.kvmGroupCommand}`, "kvm-group"),
    );
  }
  const [file, args] = ISOLATION_PROBE;
  const isolation = await probes.run(file, args, { timeoutMs: PROBE_TIMEOUT_MS });
  checks.push(
    isolation.code === 0
      ? check("isolation", "ok", LABELS.isolationTitle, LABELS.isolationOk)
      : check("isolation", "warning", LABELS.isolationTitle, [LABELS.isolation, ...LABELS.isolationCommands].join("\n"), "userns-docs"),
  );
  return checks;
}

async function windowsChecks(probes: AccelProbes): Promise<AccelCheck[]> {
  const [file, args] = WHPX_PROBE;
  const result = await probes.run(file, args, { timeoutMs: PROBE_TIMEOUT_MS });
  const state = result.stdout.trim();
  if (result.code !== 0 || !state) return [];
  return [
    state === WHPX_ENABLED
      ? check("whpx", "ok", LABELS.whpxTitle, LABELS.whpxOk)
      : check("whpx", "warning", LABELS.whpxTitle, LABELS.whpxOff, "enable-whpx"),
  ];
}

function withEmulatorVerdict(checks: AccelCheck[], emulator: EmulatorAccel | null): AccelCheck[] {
  if (emulator?.code !== 0) return checks;
  return checks.map((item) => (item.id === "whpx" && item.status === "warning" ? check("whpx", "ok", LABELS.whpxTitle, LABELS.whpxOk) : item));
}

async function macChecks(probes: AccelProbes): Promise<AccelCheck[]> {
  const [file, args] = HVF_PROBE;
  const result = await probes.run(file, args, { timeoutMs: PROBE_TIMEOUT_MS });
  return [
    result.code === 0 && result.stdout.trim() === "1"
      ? check("hvf", "ok", LABELS.hvfTitle, LABELS.hvfOk)
      : check("hvf", "error", LABELS.hvfTitle, LABELS.hvfMissing, "accel-docs"),
  ];
}

export async function emulatorAccelCheck(paths: PathEnvironment, sdkRoot: string, probes: AccelProbes = defaultProbes): Promise<EmulatorAccel | null> {
  const binary = emulatorBinary(sdkRoot, paths.platform);
  if (!(await probes.exists(binary))) return null;
  const result = await probes.run(binary, ["-accel-check"], {
    timeoutMs: ACCEL_CHECK_TIMEOUT_MS,
    env: sdkEnv(sdkRoot, paths.env as NodeJS.ProcessEnv),
  });
  if (result.timedOut) return { code: -1, message: LABELS.emulatorTimeout };
  return parseAccelCheck(`${result.stdout}\n${result.stderr}`) ?? { code: -1, message: LABELS.emulatorNoOutput };
}

export async function checkAcceleration(paths: PathEnvironment, sdkRoot: string | null, probes: AccelProbes = defaultProbes): Promise<AccelResult> {
  const platformChecks =
    paths.platform === "linux"
      ? await linuxChecks(probes)
      : paths.platform === "win32"
        ? await windowsChecks(probes)
        : paths.platform === "darwin"
          ? await macChecks(probes)
          : [];
  const emulator = sdkRoot ? await emulatorAccelCheck(paths, sdkRoot, probes) : null;
  const checks = withEmulatorVerdict(platformChecks, emulator);
  if (emulator) {
    const hint = accelHint(emulator.code);
    checks.push(
      emulator.code === 0
        ? check("emulator", "ok", LABELS.emulatorTitle, emulator.message)
        : check("emulator", "error", LABELS.emulatorTitle, hint ? `${emulator.message}\n${hint}` : emulator.message, (ACCEL_HINT_CODES.permission as readonly number[]).includes(emulator.code) ? "kvm-group" : "accel-docs"),
    );
  }
  return {
    ok: checks.every((item) => item.status !== "error") && (emulator === null || emulator.code === 0),
    checks,
    emulatorCode: emulator?.code ?? null,
    emulatorMessage: emulator?.message ?? null,
  };
}
