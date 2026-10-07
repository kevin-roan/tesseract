import { execFile, spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { createLogger } from "../../core/log";
import {
  DBUS_HAS_OWNER_ARGS,
  DBUS_MONITOR_ARGS,
  GDBUS,
  TRAY_HOST_CHECK_TIMEOUT_MS,
  TRAY_HOST_RESTART_MS,
  TRAY_WATCHER_NAME,
} from "../constants";

const log = createLogger("tray-host");

export function parseHasOwner(output: string): boolean {
  return /\(\s*true\s*,?\s*\)/.test(output);
}

export function isWatcherOwnerChange(line: string): boolean {
  return line.includes("NameOwnerChanged") && line.includes(`'${TRAY_WATCHER_NAME}'`);
}

export function trayHostAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(GDBUS, [...DBUS_HAS_OWNER_ARGS, TRAY_WATCHER_NAME], { timeout: TRAY_HOST_CHECK_TIMEOUT_MS }, (error, stdout) => {
      if (error) {
        log.debug(`could not ask D-Bus for a tray host: ${error.message}`);
        resolve(false);
        return;
      }
      resolve(parseHasOwner(stdout));
    });
  });
}

export function watchTrayHost(initial: boolean, onChange: (available: boolean) => void): () => void {
  let available = initial;
  let child: ChildProcess | null = null;
  let restart: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let broken = false;

  const recheck = async () => {
    const next = await trayHostAvailable();
    if (stopped || next === available) return;
    available = next;
    onChange(next);
  };

  const start = () => {
    if (stopped) return;
    child = spawn(GDBUS, [...DBUS_MONITOR_ARGS], { stdio: ["ignore", "pipe", "ignore"] });
    child.on("error", (error) => {
      broken = true;
      log.debug(`tray host monitor failed: ${error.message}`);
    });
    if (child.stdout) {
      createInterface({ input: child.stdout }).on("line", (line) => {
        if (isWatcherOwnerChange(line)) void recheck();
      });
    }
    child.on("exit", () => {
      child = null;
      if (stopped || broken) return;
      void recheck();
      restart = setTimeout(start, TRAY_HOST_RESTART_MS);
    });
  };

  start();
  return () => {
    stopped = true;
    if (restart) clearTimeout(restart);
    child?.kill();
    child = null;
  };
}
