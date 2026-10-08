import { TesseractClient, type SocketConstructor } from "@tesseract/client";
import type { ConnectionConfig } from "../../../shared/contracts/connection";
import { fixtureFetch } from "../../fixtures/fetch";
import { FixtureSocket } from "../../fixtures/socket";
import { isFixtureMode } from "../runtime";
import { ipcFetch } from "./ipc-fetch";

const cache = new Map<string, TesseractClient>();

export function createApiClient(config: Pick<ConnectionConfig, "apiUrl" | "token">): TesseractClient | null {
  const fixtures = isFixtureMode();
  const key = `${fixtures ? "fixtures" : "live"}|${config.apiUrl}|${config.token}`;
  const cached = cache.get(key);
  if (cached) return cached;
  try {
    const client = new TesseractClient({
      baseUrl: config.apiUrl,
      token: config.token,
      fetch: fixtures ? fixtureFetch : ipcFetch,
      WebSocket: fixtures ? (FixtureSocket as SocketConstructor) : undefined,
    });
    cache.set(key, client);
    return client;
  } catch {
    return null;
  }
}
