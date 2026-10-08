import { TesseractClient } from "@tesseract/client";

import type { PairedSandbox } from "../types";
import { PAIRING_TIMEOUT_MS } from "../utils/constants";

const clients = new Map<string, { baseUrl: string; token: string; client: TesseractClient }>();

export function getSandboxClient(sandbox: PairedSandbox, token: string): TesseractClient {
  const cached = clients.get(sandbox.id);
  if (cached && cached.baseUrl === sandbox.baseUrl && cached.token === token) return cached.client;
  const client = new TesseractClient({ baseUrl: sandbox.baseUrl, token });
  clients.set(sandbox.id, { baseUrl: sandbox.baseUrl, token, client });
  return client;
}

export function forgetSandboxClient(sandboxId: string): void {
  clients.delete(sandboxId);
}

export function clearSandboxClients(): void {
  clients.clear();
}

export function createProbeClient(baseUrl: string, token: string): TesseractClient {
  return new TesseractClient({ baseUrl, token, timeoutMs: PAIRING_TIMEOUT_MS });
}
