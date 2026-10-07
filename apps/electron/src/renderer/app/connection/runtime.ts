import type { Unsubscribe } from "../../../shared/contracts/common";
import { ipc } from "../../lib/ipc";
import { createApiClient } from "../data/client";
import { ConnectionController } from "./controller";
import { MetricsHistory } from "./metrics-history";

let controller: ConnectionController | null = null;
let history: MetricsHistory | null = null;
let teardown: Unsubscribe | null = null;

export function connectionController(): ConnectionController {
  controller ??= new ConnectionController({
    load: () => ipc.connection.load(),
    save: (input) => ipc.connection.save(input),
    forget: () => ipc.connection.forget(),
    discover: () => ipc.connection.discover(),
    onChanged: (listener) => ipc.connection.on("changed", listener),
    createClient: (config) => createApiClient(config),
  });
  return controller;
}

export function metricsHistory(): MetricsHistory {
  history ??= new MetricsHistory({
    persistence: { load: () => ipc.metrics.load(), save: (cache) => ipc.metrics.save(cache) },
  });
  return history;
}

export function wireMetrics(source: ConnectionController, target: MetricsHistory): Unsubscribe {
  void target.hydrate();
  return source.store.subscribe((state, previous) => {
    if (previous.status === "online" && state.status !== "online") target.markBreak();
    if (state.sandbox === previous.sandbox) return;
    if (state.sandbox) target.record(state.sandbox);
    else target.markBreak();
  });
}

function wireVisibility(source: ConnectionController): Unsubscribe {
  let windowVisible = true;
  const update = () => source.setWindowVisible(windowVisible && globalThis.document?.visibilityState !== "hidden");
  const fromWindow = (visible: boolean) => {
    windowVisible = visible;
    update();
  };
  ipc.window
    .state()
    .then((state) => fromWindow(state.visible))
    .catch(() => undefined);
  const stopWindow = ipc.window.on("state", (state) => fromWindow(state.visible));
  globalThis.document?.addEventListener("visibilitychange", update);
  return () => {
    stopWindow();
    globalThis.document?.removeEventListener("visibilitychange", update);
  };
}

function wirePersistence(target: MetricsHistory): Unsubscribe {
  const save = () => void target.save();
  globalThis.addEventListener?.("beforeunload", save);
  return () => globalThis.removeEventListener?.("beforeunload", save);
}

export function ensureConnectionRuntime(): ConnectionController {
  const instance = connectionController();
  if (teardown) return instance;
  const stops = [wireMetrics(instance, metricsHistory()), wireVisibility(instance), wirePersistence(metricsHistory())];
  teardown = () => stops.forEach((stop) => stop());
  void instance.start();
  return instance;
}

export function resetConnectionRuntime(): void {
  teardown?.();
  teardown = null;
  controller?.stop();
  controller = null;
  history = null;
}
