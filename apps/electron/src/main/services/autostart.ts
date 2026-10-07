import { effectiveEnv, probeDocker } from "../../core/docker";
import { createLogger } from "../../core/log";
import { runAutostart, SANDBOX_LABELS, type AutostartOutcome, type SandboxContext } from "../../core/sandbox";
import { mainContext } from "../context";
import { serviceEmitter } from "../ipc/_framework/events";
import { showNotification } from "./notifications";
import { sandboxContext } from "./resources";
import { currentSettings } from "./settings";

const log = createLogger("autostart");
const events = serviceEmitter("sandbox");
const SETTINGS_COMMAND = { type: "preferences", section: "sandbox" } as const;

let running: Promise<AutostartOutcome> | null = null;

function context(): SandboxContext {
  const env = effectiveEnv();
  return {
    ...sandboxContext(),
    env,
    configFile: mainContext().configFile,
    deps: { probeDocker: () => probeDocker({ env }) },
  };
}

export function reportAutostart(outcome: AutostartOutcome): void {
  if (outcome.kind === "started") {
    events.emit("status", outcome.status);
    log.info(SANDBOX_LABELS.autostart.started(outcome.project));
  } else if (outcome.kind === "failed") {
    log.warn(`sandbox autostart failed: ${outcome.message}`);
    showNotification({ id: "sandbox-autostart", title: SANDBOX_LABELS.autostart.failedTitle, body: outcome.message, command: SETTINGS_COMMAND });
  } else if (outcome.kind === "skip" && outcome.reason === "docker-unreachable") {
    log.warn(`sandbox autostart skipped: Docker is not reachable${outcome.detail ? ` (${outcome.detail})` : ""}`);
    showNotification({ id: "sandbox-autostart", title: SANDBOX_LABELS.autostart.dockerTitle, body: SANDBOX_LABELS.autostart.dockerBody, command: SETTINGS_COMMAND });
  } else if (outcome.kind === "skip") {
    log.debug(`sandbox autostart skipped: ${outcome.reason}`);
  }
}

export function startSandboxAutostart(): Promise<AutostartOutcome> | null {
  const { isTest, fixtures } = mainContext();
  if (isTest || fixtures) return null;
  running ??= runAutostart(context(), currentSettings().sandboxAutostart, {
    onLog: (line) => events.emit("log", line),
  }).then((outcome) => {
    reportAutostart(outcome);
    return outcome;
  });
  return running;
}
