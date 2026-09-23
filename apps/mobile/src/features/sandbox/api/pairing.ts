import type { TheOneClient } from "@theone/client";

import type { NewSandbox, PairedSandbox } from "../types";
import { fallbackSandboxName, type ValidPairing } from "../utils/pairing";
import { createProbeClient } from "./client";

export async function pairSandbox(
  pairing: ValidPairing,
  save: (sandbox: NewSandbox) => Promise<PairedSandbox>,
  createClient: (baseUrl: string, token: string) => TheOneClient = createProbeClient,
): Promise<PairedSandbox> {
  const client = createClient(pairing.baseUrl, pairing.token);
  const health = await client.health();
  const status = await client.status();
  return save({
    name: fallbackSandboxName(pairing.name, health.sandboxId, status.hostname),
    baseUrl: client.baseUrl,
    token: pairing.token,
  });
}
