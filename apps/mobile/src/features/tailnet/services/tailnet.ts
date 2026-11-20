import type { EventSubscription } from "expo-modules-core";
import type { DeviceKey, TailnetStatus } from "@tesseract/protocol";

import * as Tailnet from "@/modules/tesseract-tailnet";

import { tailnetConfigStorage, type TailnetConfig } from "../store/tailnet-config-storage";
import { useTailnetStore } from "../store/tailnet-store";
import { TAILNET_READY_TIMEOUT_MS } from "../utils/constants";
import { forwardKey, loopbackUrl, normalizeSuffix, tailnetTargetOf, type TailnetTarget } from "../utils/url";

let subscription: EventSubscription | null = null;
let starting: Promise<void> | null = null;
let generation = 0;
const forwards = new Map<string, Promise<number>>();
const ports = new Map<string, number>();

function clearForwards(): void {
  generation += 1;
  forwards.clear();
  ports.clear();
}

function applyStatus(status: TailnetStatus | null): void {
  const store = useTailnetStore.getState();
  if (status?.state !== "running") clearForwards();
  store.setStatus(status);
  const suffix = normalizeSuffix(status?.magicDnsSuffix);
  const config = store.config;
  if (suffix && config && config.magicDnsSuffix !== suffix) {
    const next = { ...config, magicDnsSuffix: suffix };
    store.setConfig(next);
    void tailnetConfigStorage.write(next).catch(() => undefined);
  }
}

function ensureListening(): void {
  subscription ??= Tailnet.addStatusListener(applyStatus);
}

async function refreshStatus(): Promise<void> {
  applyStatus(await Tailnet.status());
}

function startNode(config: TailnetConfig, authKey?: string): Promise<void> {
  ensureListening();
  clearForwards();
  let run: Promise<void> | null = null;
  run = (async () => {
    try {
      await Tailnet.start({ controlUrl: config.loginServer, authKey, hostname: config.hostname });
    } finally {
      if (starting === run) starting = null;
      await refreshStatus().catch(() => undefined);
    }
  })();
  starting = run;
  return run;
}

async function storedConfig(): Promise<TailnetConfig | null> {
  const store = useTailnetStore.getState();
  if (store.config) return store.config;
  const config = await tailnetConfigStorage.read();
  if (config) store.setConfig(config);
  return config;
}

export const isTailnetAvailable = Tailnet.isTailnetAvailable;

export async function connectTailnet(key: DeviceKey): Promise<void> {
  const config: TailnetConfig = {
    loginServer: key.loginServer,
    hostname: key.hostname,
    magicDnsSuffix: normalizeSuffix(key.magicDnsSuffix),
  };
  await tailnetConfigStorage.write(config);
  useTailnetStore.getState().setConfig(config);
  if (!Tailnet.isTailnetAvailable()) return;
  await startNode(config, key.authKey);
}

export async function resumeTailnet(): Promise<void> {
  if (starting) return starting;
  const config = await storedConfig();
  if (!config || !Tailnet.isTailnetAvailable()) return;
  ensureListening();
  const current = await Tailnet.status();
  if (current?.state === "running" || current?.state === "starting") {
    applyStatus(current);
    return;
  }
  if (starting) return starting;
  await startNode(config);
}

export async function disconnectTailnet(options?: { logout?: boolean }): Promise<void> {
  clearForwards();
  if (Tailnet.isTailnetAvailable()) {
    await (options?.logout ? Tailnet.logout() : Tailnet.stop());
  }
  if (options?.logout) {
    await tailnetConfigStorage.remove();
    useTailnetStore.getState().setConfig(null);
  }
  if (Tailnet.isTailnetAvailable()) await refreshStatus();
  else applyStatus(null);
}

function currentSuffix(): string | null {
  const { status, config } = useTailnetStore.getState();
  return normalizeSuffix(status?.magicDnsSuffix) ?? config?.magicDnsSuffix ?? null;
}

function isPending(): boolean {
  const { status } = useTailnetStore.getState();
  return starting !== null || status?.state === "starting";
}

function waitForRunning(timeoutMs = TAILNET_READY_TIMEOUT_MS): Promise<boolean> {
  if (useTailnetStore.getState().status?.state === "running") return Promise.resolve(true);
  if (!isPending()) return Promise.resolve(false);
  return new Promise((resolve) => {
    const finish = (value: boolean) => {
      clearTimeout(timer);
      unsubscribe();
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    const unsubscribe = useTailnetStore.subscribe(({ status }) => {
      if (status?.state === "running") finish(true);
      else if (!isPending()) finish(false);
    });
  });
}

function forwardPort(target: TailnetTarget): Promise<number> {
  const key = forwardKey(target);
  const existing = forwards.get(key);
  if (existing) return existing;
  const owner = generation;
  const pending = Tailnet.forward(target.host, target.port).then(
    (port) => {
      if (owner === generation) ports.set(key, port);
      return port;
    },
    (error: unknown) => {
      if (owner === generation) forwards.delete(key);
      throw error;
    },
  );
  forwards.set(key, pending);
  return pending;
}

export function peekTailnetUrl(url: string): string | null {
  if (!Tailnet.isTailnetAvailable()) return url;
  const target = tailnetTargetOf(url, currentSuffix());
  if (!target) return url;
  const port = ports.get(forwardKey(target));
  return port ? loopbackUrl(target, port) : null;
}

export async function resolveTailnetUrl(url: string): Promise<string> {
  if (!Tailnet.isTailnetAvailable()) return url;
  const target = tailnetTargetOf(url, currentSuffix());
  if (!target) return url;
  if (!(await waitForRunning())) return url;
  return loopbackUrl(target, await forwardPort(target));
}
