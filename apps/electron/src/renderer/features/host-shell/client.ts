import { TesseractClient, type SocketConstructor } from "@tesseract/client";
import { proxyFetch } from "../../app/data";
import { isFixtureMode } from "../../app/runtime";
import { FixtureSocket } from "../../fixtures/socket";
import { ipc } from "../../lib/ipc";
import { HOST_PROXY_TOKEN } from "./constants";

const hostFetch = proxyFetch({ request: (id, request) => ipc.hostShell.request(id, request), abort: (id) => ipc.hostShell.abort(id) });
const cache = new Map<string, TesseractClient>();

export function createHostClient(baseUrl: string): TesseractClient | null {
  const fixtures = isFixtureMode();
  const key = `${fixtures ? "fixtures" : "live"}|${baseUrl}`;
  const cached = cache.get(key);
  if (cached) return cached;
  try {
    const client = new TesseractClient({
      baseUrl,
      token: HOST_PROXY_TOKEN,
      fetch: hostFetch,
      WebSocket: fixtures ? (FixtureSocket as SocketConstructor) : undefined,
    });
    cache.set(key, client);
    return client;
  } catch {
    return null;
  }
}
