import { unwatchFile, watchFile } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import { ANDROID_CONFIG_KEYS } from "../../core/android";
import { readConfig } from "../../core/config";
import {
  EmulatorViewer,
  HOST_LABELS,
  HostShellError,
  HostShellService,
  HOST_ANDROID_ENV_KEYS,
  HOST_IOS_ENV_KEYS,
  hostDaemonEnv,
  hostTerminalKind,
  isServing,
  resolveControllerCommand,
  simcapPath,
  type HostEnv,
} from "../../core/host";
import { HOST_WORKSPACE, HostWorkspaceService, workspaceAccounts } from "../../core/host-workspace";
import { readEnvValues } from "../../core/sandbox";
import { createLogger } from "../../core/log";
import { HostRouter } from "../../core/master-host";
import { defaultAndroidSdkRoot, stateDir } from "../../core/paths";
import { requireLink, syncState } from "../../core/syncback";
import { CONFIG_POLL_MS } from "../../core/syncback/constants";
import type { EmulatorStopSignal, EmulatorViewerRequest, HostShellState, HostTerminalRequest, HostWorkspaceTarget } from "../../shared/contracts/hostShell";
import type { ConnectionSnapshot } from "../../shared/contracts/connection";
import type { HttpProxyRequest } from "../../shared/contracts/http";
import { mainContext } from "../context";
import { publishLocalHost } from "../services/local-host";
import { isPlainProjectId } from "../services/project-id";
import { repoRoot, sandboxContext } from "../services/resources";
import { currentSettings, onSettingsChanged, updateSettings } from "../services/settings";
import { createHostTerminalWindow } from "../windows/manager";
import { onConnectionChanged } from "./connection";
import { activeHostRoute } from "./masterHost";
import { defineService } from "./_framework/define";
import { serviceEmitter } from "./_framework/events";


const events = serviceEmitter("hostShell");
const log = createLogger("host-shell");

let service: HostShellService | null = null;
let router: HostRouter | null = null;
let viewer: EmulatorViewer | null = null;
let workspace: HostWorkspaceService | null = null;
let serving = false;
let exiting = false;
const inflight = new Map<string, AbortController>();

async function daemonEnv(): Promise<HostEnv> {
  const context = mainContext();
  const config = await readConfig(context.configFile).catch(() => ({}) as Record<string, unknown>);
  const configured = config[ANDROID_CONFIG_KEYS.sdkRoot];
  return hostDaemonEnv(process.env, {
    platform: process.platform,
    sdkRoot: typeof configured === "string" && configured ? configured : null,
    defaultSdkRoot: defaultAndroidSdkRoot(context.paths),
    ios: currentSettings().hostShellIos,
    simcap: simcapPath({
      packaged: app.isPackaged,
      resourcesPath: app.isPackaged ? process.resourcesPath : null,
      repoRoot: repoRoot(),
      arch: process.arch,
    }),
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
    onChange: (state) => {
      publishLocalHost(state);
      router?.localChanged(state);
      const wasServing = serving;
      serving = isServing(state);
      if (serving && !wasServing) void hostWorkspace().syncAll();
    },
  });
  return service;
}

function links() {
  return syncState({ stateDir: stateDir(mainContext().paths) });
}

function hostWorkspace(): HostWorkspaceService {
  workspace ??= new HostWorkspaceService({
    runner: async () => ({ command: controllerCommand(), env: await workspaceEnv(), logFile: join(app.getPath("userData"), ...HOST_WORKSPACE.logFile) }),
    links: async () => [...(await links().links()).values()].map(({ projectId, hostPath }) => ({ projectId, hostPath })),
    warn: (message) => log.warn(message),
  });
  return workspace;
}

async function workspaceEnv(): Promise<NodeJS.ProcessEnv> {
  const values = await readEnvValues(sandboxContext().envFile).catch(() => null);
  const accounts = workspaceAccounts(values?.TESSERACT_HOST_CLAUDE_ACCOUNTS, process.env.HOME || app.getPath("home"));
  return { ...process.env, [HOST_WORKSPACE.accountsEnv]: accounts };
}

function syncWorkspaceLinks(): void {
  if (serving) void hostWorkspace().syncAll();
}

function routed(): HostRouter {
  router ??= new HostRouter({
    local: host,
    emit: (state) => events.emit("state", state),
    autostart: () => host().state().autostart,
  });
  return router;
}

function target(): HostShellService {
  return routed().current();
}

async function followActiveMachine(snapshot?: ConnectionSnapshot): Promise<void> {
  routed().follow(await activeHostRoute(snapshot));
}

async function setAutostart(enabled: boolean): Promise<HostShellState> {
  await host().setAutostart(enabled);
  const current = target();
  return current === host() ? current.state() : current.setAutostart(enabled);
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

function requireTerminalRequest(request: HostTerminalRequest): Required<HostTerminalRequest> {
  if (typeof request !== "object" || request === null || !isPlainProjectId(request.projectId)) {
    throw new HostShellError(HOST_LABELS.noFolder, "invalid_argument");
  }
  return {
    projectId: request.projectId,
    title: typeof request.title === "string" && request.title ? request.title : request.projectId,
    kind: hostTerminalKind(request.kind),
  };
}

function requireSignal(signal: unknown): EmulatorStopSignal | undefined {
  if (signal === undefined || signal === null) return undefined;
  if (signal === "SIGTERM" || signal === "SIGKILL") return signal;
  throw new HostShellError(HOST_LABELS.invalidSignal, "invalid_argument");
}

function requireProxyRequest(request: HttpProxyRequest): HttpProxyRequest {
  if (typeof request !== "object" || request === null || typeof request.url !== "string" || typeof request.method !== "string") {
    throw new HostShellError(HOST_LABELS.proxyForbidden(""), "invalid_argument");
  }
  return {
    url: request.url,
    method: request.method,
    headers: typeof request.headers === "object" && request.headers !== null ? request.headers : {},
    body: typeof request.body === "string" ? request.body : undefined,
    timeoutMs: typeof request.timeoutMs === "number" ? request.timeoutMs : undefined,
  };
}

async function proxy(id: string, request: HttpProxyRequest) {
  const key = requireString(id, HOST_LABELS.proxyForbidden(""));
  const controller = new AbortController();
  inflight.set(key, controller);
  try {
    return await target().proxy(requireProxyRequest(request), controller.signal);
  } finally {
    if (inflight.get(key) === controller) inflight.delete(key);
  }
}

function abortProxy(id: string): void {
  inflight.get(id)?.abort();
  inflight.delete(id);
}

async function hostPathOf(projectId: string): Promise<string> {
  try {
    return (await requireLink(links(), projectId)).hostPath;
  } catch (error) {
    throw new HostShellError(error instanceof Error ? error.message : HOST_LABELS.noFolder, "not_found");
  }
}

async function openTerminal(input: HostTerminalRequest): Promise<void> {
  const request = requireTerminalRequest(input);
  const hostPath = await hostPathOf(request.projectId);
  const url = await host().openTerminal(hostPath, request.kind);
  await createHostTerminalWindow(url, HOST_LABELS.terminalTitle[request.kind](request.title));
}

async function openWorkspace(projectId: unknown): Promise<HostWorkspaceTarget> {
  if (!isPlainProjectId(projectId)) throw new HostShellError(HOST_LABELS.noFolder, "invalid_argument");
  return hostWorkspace().open({ projectId, hostPath: await hostPathOf(projectId) });
}

export function applyAndroidSdkChange(): Promise<HostShellState | null> {
  return service ? service.restartIfEnvChanged(HOST_ANDROID_ENV_KEYS) : Promise.resolve(null);
}

function applyIosChange(): void {
  void service?.restartIfEnvChanged(HOST_IOS_ENV_KEYS).catch((error: unknown) => {
    log.warn(`host shell restart failed: ${error instanceof Error ? error.message : String(error)}`);
  });
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
    state: () => target().state(),
    start: () => target().start(),
    stop: () => target().stop(),
    refresh: () => target().refresh(),
    setPin: (_context, pin) => target().setPin(requireString(pin, HOST_LABELS.invalidPin)),
    rotateToken: () => target().rotateToken(),
    setAutostart: (_context, enabled) => setAutostart(enabled === true),
    unlock: (_context, pin) => target().unlock(requireString(pin, HOST_LABELS.invalidPin)),
    lock: () => target().lock(),
    androidStatus: () => target().androidStatus(),
    startEmulator: (_context, avd) => target().startEmulator(requireString(avd, HOST_LABELS.invalidAvd)),
    stopEmulator: (_context, signal) => target().stopEmulator(requireSignal(signal)),
    linkSandbox: (_context, sandboxUrl, token) =>
      target().linkSandbox(
        requireString(sandboxUrl, HOST_LABELS.invalidSandbox),
        requireString(token, HOST_LABELS.invalidSandbox),
      ),
    iosStatus: () => target().iosStatus(),
    bootSimulator: (_context, udid) => target().bootSimulator(requireString(udid, HOST_LABELS.invalidUdid)),
    shutdownSimulator: (_context, signal) => target().shutdownSimulator(requireSignal(signal)),
    linkIosSandbox: (_context, sandboxUrl, token) =>
      target().linkIosSandbox(
        requireString(sandboxUrl, HOST_LABELS.invalidSandbox),
        requireString(token, HOST_LABELS.invalidSandbox),
      ),
    openEmulatorViewer: (_context, request) => emulatorViewer().open(requireViewerRequest(request)),
    openTerminal: (_context, request) => openTerminal(request),
    openWorkspace: (_context, projectId) => openWorkspace(projectId),
    request: (_context, id, request) => proxy(id, request),
    abort: (_context, id) => abortProxy(id),
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
      const follow = (snapshot?: ConnectionSnapshot) =>
        void followActiveMachine(snapshot).catch((error: unknown) => {
          log.warn(`host routing failed: ${error instanceof Error ? error.message : String(error)}`);
        });
      const stopFollowing = onConnectionChanged(follow);
      const stopSettings = onSettingsChanged((next, previous) => {
        if (next.hostShellIos !== previous.hostShellIos) applyIosChange();
      });
      follow();
      const linksPath = links().linksPath;
      watchFile(linksPath, { interval: CONFIG_POLL_MS }, syncWorkspaceLinks);
      return () => {
        unwatchFile(linksPath, syncWorkspaceLinks);
        stopFollowing();
        stopSettings();
        for (const controller of inflight.values()) controller.abort();
        inflight.clear();
        return current.shutdown();
      };
    },
  },
);
