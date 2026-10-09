import { app } from "electron";
import { ANDROID_CONFIG_KEYS } from "../../core/android";
import { readConfig } from "../../core/config";
import {
  EmulatorViewer,
  HOST_LABELS,
  HostShellError,
  HostShellService,
  HOST_ANDROID_ENV_KEYS,
  hostDaemonEnv,
  resolveControllerCommand,
  type HostEnv,
} from "../../core/host";
import { createLogger } from "../../core/log";
import { defaultAndroidSdkRoot, stateDir } from "../../core/paths";
import { requireLink, syncState } from "../../core/syncback";
import type { EmulatorViewerRequest, HostShellState, HostTerminalRequest } from "../../shared/contracts/hostShell";
import { mainContext } from "../context";
import { isPlainProjectId } from "../services/project-id";
import { repoRoot } from "../services/resources";
import { currentSettings, updateSettings } from "../services/settings";
import { createHostTerminalWindow } from "../windows/manager";
import { defineService } from "./_framework/define";
import { serviceEmitter } from "./_framework/events";


const events = serviceEmitter("hostShell");
const log = createLogger("host-shell");

let service: HostShellService | null = null;
let viewer: EmulatorViewer | null = null;
let exiting = false;

async function daemonEnv(): Promise<HostEnv> {
  const context = mainContext();
  const config = await readConfig(context.configFile).catch(() => ({}) as Record<string, unknown>);
  const configured = config[ANDROID_CONFIG_KEYS.sdkRoot];
  return hostDaemonEnv(process.env, {
    platform: process.platform,
    sdkRoot: typeof configured === "string" && configured ? configured : null,
    defaultSdkRoot: defaultAndroidSdkRoot(context.paths),
  });
}

function controllerCommand(): string[] {
  return resolveControllerCommand({
    env: process.env,
    resourcesPath: app.isPackaged ? process.resourcesPath : null,
    packaged: app.isPackaged,
    repoRoot: repoRoot(),
    platform: process.platform,
  });
}

function host(): HostShellService {
  service ??= new HostShellService({
    command: controllerCommand,
    env: daemonEnv,
    platform: process.platform,
    autostart: currentSettings().hostShellAutostart,
    saveAutostart: async (enabled) => {
      await updateSettings({ hostShellAutostart: enabled });
    },
    onChange: (state) => events.emit("state", state),
  });
  return service;
}

function emulatorViewer(): EmulatorViewer {
  viewer ??= new EmulatorViewer({ env: () => host().env(), platform: process.platform });
  return viewer;
}

function requireString(value: unknown, message: string): string {
  if (typeof value !== "string") throw new HostShellError(message, "invalid_argument");
  return value;
}

function requireViewerRequest(request: EmulatorViewerRequest): EmulatorViewerRequest {
  if (typeof request !== "object" || request === null) throw new HostShellError(HOST_LABELS.noSerial, "invalid_argument");
  return {
    serial: requireString(request.serial, HOST_LABELS.noSerial),
    title: typeof request.title === "string" ? request.title : "",
  };
}

function requireTerminalRequest(request: HostTerminalRequest): HostTerminalRequest {
  if (typeof request !== "object" || request === null || !isPlainProjectId(request.projectId)) {
    throw new HostShellError(HOST_LABELS.noFolder, "invalid_argument");
  }
  return { projectId: request.projectId, title: typeof request.title === "string" && request.title ? request.title : request.projectId };
}

async function openTerminal(input: HostTerminalRequest): Promise<void> {
  const request = requireTerminalRequest(input);
  let hostPath: string;
  try {
    hostPath = (await requireLink(syncState({ stateDir: stateDir(mainContext().paths) }), request.projectId)).hostPath;
  } catch (error) {
    throw new HostShellError(error instanceof Error ? error.message : HOST_LABELS.noFolder, "not_found");
  }
  const url = await host().openTerminal(hostPath);
  await createHostTerminalWindow(url, HOST_LABELS.terminalTitle(request.title));
}

export function applyAndroidSdkChange(): Promise<HostShellState | null> {
  return service ? service.restartIfEnvChanged(HOST_ANDROID_ENV_KEYS) : Promise.resolve(null);
}

function onWillQuit(event: Electron.Event): void {
  const current = service;
  if (!current?.hasChild() || exiting) return;
  event.preventDefault();
  exiting = true;
  void current.shutdown().finally(() => app.exit(0));
}

export default defineService(
  "hostShell",
  {
    state: () => host().state(),
    start: () => host().start(),
    stop: () => host().stop(),
    refresh: () => host().refresh(),
    setPin: (_context, pin) => host().setPin(requireString(pin, HOST_LABELS.invalidPin)),
    rotateToken: () => host().rotateToken(),
    setAutostart: (_context, enabled) => host().setAutostart(enabled === true),
    unlock: (_context, pin) => host().unlock(requireString(pin, HOST_LABELS.invalidPin)),
    lock: () => host().lock(),
    androidStatus: () => host().androidStatus(),
    startEmulator: (_context, avd) => host().startEmulator(requireString(avd, HOST_LABELS.invalidAvd)),
    stopEmulator: () => host().stopEmulator(),
    linkSandbox: (_context, sandboxUrl, token) =>
      host().linkSandbox(
        requireString(sandboxUrl, HOST_LABELS.invalidSandbox),
        requireString(token, HOST_LABELS.invalidSandbox),
      ),
    openEmulatorViewer: (_context, request) => emulatorViewer().open(requireViewerRequest(request)),
    openTerminal: (_context, request) => openTerminal(request),
  },
  {
    start: () => {
      const current = host();
      app.on("will-quit", onWillQuit);
      if (!mainContext().fixtures) {
        void current.init().catch((error: unknown) => {
          log.warn(`host shell startup failed: ${error instanceof Error ? error.message : String(error)}`);
        });
      }
      return () => current.shutdown();
    },
  },
);
