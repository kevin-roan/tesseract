import type { WebContents } from "electron";

type Delivery = () => void;

const ready = new Set<number>();
const queued = new Map<number, Delivery[]>();

function flush(id: number): void {
  const deliveries = queued.get(id);
  if (!deliveries) return;
  queued.delete(id);
  for (const deliver of deliveries) deliver();
}

export function markRendererIdle(webContentsId: number): void {
  ready.add(webContentsId);
  flush(webContentsId);
}

export function isRendererIdle(webContentsId: number): boolean {
  return ready.has(webContentsId);
}

export function trackRendererLoad(contents: WebContents): void {
  const id = contents.id;
  contents.on("did-start-loading", () => ready.delete(id));
  contents.once("destroyed", () => {
    ready.delete(id);
    queued.delete(id);
  });
}

export function deliverWhenReady(contents: WebContents, deliver: Delivery): void {
  if (contents.isDestroyed()) return;
  if (ready.has(contents.id)) {
    deliver();
    return;
  }
  const deliveries = queued.get(contents.id) ?? [];
  deliveries.push(deliver);
  queued.set(contents.id, deliveries);
}
