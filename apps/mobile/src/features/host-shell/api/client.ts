import { HostShellClient, type TesseractClient } from "@tesseract/client";

import { HOST_PROBE_TIMEOUT_MS } from "../utils/constants";

let cached: { baseUrl: string; token: string; client: HostShellClient } | null = null;
let cachedSession: { client: HostShellClient; session: string; sessionClient: TesseractClient } | null = null;

export function getHostClient(baseUrl: string, token: string): HostShellClient {
  if (cached && cached.baseUrl === baseUrl && cached.token === token) return cached.client;
  cached = { baseUrl, token, client: new HostShellClient({ baseUrl, token }) };
  return cached.client;
}

export function getHostSessionClient(client: HostShellClient, session: string): TesseractClient {
  if (cachedSession && cachedSession.client === client && cachedSession.session === session) return cachedSession.sessionClient;
  cachedSession = { client, session, sessionClient: client.sessionClient(session) };
  return cachedSession.sessionClient;
}

export function createHostProbeClient(baseUrl: string, token: string): HostShellClient {
  return new HostShellClient({ baseUrl, token, timeoutMs: HOST_PROBE_TIMEOUT_MS });
}
