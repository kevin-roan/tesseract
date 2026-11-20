import { hostname as osHostname } from "node:os";
import { join } from "node:path";
import { app } from "electron";
import { effectiveEnv } from "../../core/docker";
import {
  HOST_TAILNET,
  HostTailnetSupervisor,
  hostTailnetEnabled,
  hostTailnetEnv,
  hostTailnetHostname,
  tailnetBinaryPath,
  type SupervisorState,
} from "../../core/host-tailnet";
import { createLogger } from "../../core/log";
import { runCommand } from "../../core/process";
import { tailscaleIpv4 } from "../../core/sandbox";
import type { HostTailnetMode, HostTailnetState } from "../../shared/contracts/tailnet";
import { broadcast } from "../ipc/_framework/events";
import { accountService } from "./account";
import { repoRoot } from "./resources";
import { currentSettings, updateSettings } from "./settings";

const log = createLogger("host-tailnet");

let supervisor: HostTailnetSupervisor | null = null;
let tailscaleDetected = false;
let lastUrls: string | null = null;
let syncing: Promise<HostTailnetState> | null = null;
const urlListeners = new Set<() => void>();

function binary(): string | null {
  return tailnetBinaryPath({
    packaged: app.isPackaged,
    resourcesPath: app.isPackaged ? process.resourcesPath : null,
    repoRoot: repoRoot(),
    platform: process.platform,
    arch: process.arch,
  });
}

function node(): HostTailnetSupervisor {
  supervisor ??= new HostTailnetSupervisor({
    binary,
    stateDir: join(app.getPath("userData"), HOST_TAILNET.stateDir),
    metaFile: join(app.getPath("userData"), HOST_TAILNET.metaFile),
    deviceKey: (hostname) => accountService().deviceKey("desktop", hostname),
    onChange: (state) => publish(state),
  });
  return supervisor;
}

function enabled(): boolean {
  return hostTailnetEnabled(currentSettings().hostTailnet, accountService().signedIn(), tailscaleDetected);
}

export function hostTailnetState(): HostTailnetState {
  const state = node().state();
  const on = enabled();
  return {
    mode: currentSettings().hostTailnet,
    enabled: on,
    status: !on && !accountService().signedIn() ? "signed-out" : state.status,
    tailscaleDetected,
    hostname: state.hostname ?? (on ? hostTailnetHostname(osHostname()) : null),
    shellUrl: state.urls?.shell ?? null,
    workspaceUrl: state.urls?.workspace ?? null,
    node: state.node,
    error: state.error,
    binary: binary(),
  };
}

function publish(state: SupervisorState): void {
  broadcast("tailnet", "state", hostTailnetState());
  const urls = state.urls ? `${state.urls.shell} ${state.urls.workspace}` : null;
  if (urls === lastUrls) return;
  lastUrls = urls;
  for (const listener of urlListeners) listener();
}

/** Env for the host shell and host workspace daemons: loopback binds + Tesseract Network URLs while the node is wanted. */
export function hostTailnetDaemonEnv(): Record<string, string | undefined> {
  return hostTailnetEnv(supervisor?.urls() ?? null);
}

/** Fires when the daemons' public URLs appear, change or go away (they then restart with the new env). */
export function onHostTailnetUrlsChanged(listener: () => void): () => void {
  urlListeners.add(listener);
  return () => {
    urlListeners.delete(listener);
  };
}

async function detectTailscale(): Promise<void> {
  tailscaleDetected = Boolean(await tailscaleIpv4({ run: runCommand }, effectiveEnv()).catch(() => ""));
}

/** Starts or stops the node to match the setting, the account and whether Tailscale runs. */
export function syncHostTailnet(options: { redetect?: boolean } = {}): Promise<HostTailnetState> {
  const run = async () => {
    if (options.redetect) await detectTailscale();
    if (enabled()) await node().start(hostTailnetHostname(osHostname()));
    else await node().stop();
    const state = hostTailnetState();
    broadcast("tailnet", "state", state);
    return state;
  };
  const next = (syncing ?? Promise.resolve()).catch(() => undefined).then(run);
  syncing = next.finally(() => {
    if (syncing === next) syncing = null;
  });
  return next;
}

export async function setHostTailnetMode(mode: HostTailnetMode): Promise<HostTailnetState> {
  await updateSettings({ hostTailnet: mode });
  return syncHostTailnet();
}

export async function restartHostTailnet(): Promise<HostTailnetState> {
  await detectTailscale();
  if (!enabled()) return syncHostTailnet();
  await node().restart();
  return syncHostTailnet();
}

/** The account went away (sign-out, deletion, other server): drop the node's identity too. */
export async function resetHostTailnet(): Promise<void> {
  await node().reset();
  broadcast("tailnet", "state", hostTailnetState());
}

export async function initHostTailnet(): Promise<void> {
  await syncHostTailnet({ redetect: true }).catch((error: unknown) => {
    log.warn(`tesseract-tailnet startup failed: ${error instanceof Error ? error.message : String(error)}`);
  });
}

export function stopHostTailnet(): Promise<void> {
  return supervisor?.stop() ?? Promise.resolve();
}
