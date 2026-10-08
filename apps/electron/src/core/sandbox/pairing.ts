import { buildPairingLink, isValidToken } from "@tesseract/protocol";
import type { PairingInfo } from "../../shared/contracts/sandbox";
import { IpcError } from "../../shared/ipc-types";
import { updateConfig, withConnection } from "../config";
import type { EnvValues } from "./env-file";
import { firstHealthy, stackEndpoint, type StackEndpoint } from "./health";
import { SANDBOX_LABELS } from "./labels";
import { sandboxConfigFile } from "./settings";
import { readEnvValues } from "./stack";
import { sandboxDeps, type SandboxContext, type SandboxDeps } from "./types";

export interface PairedConnection {
  apiUrl: string;
  token: string;
  name: string | null;
  pairingUrl: string | null;
}

export type PairingResolution = { ok: true; connection: PairedConnection; message: string } | { ok: false; message: string };

const LOOPBACK_HOSTS = ["127.0.0.1", "localhost", "[::1]", "::1"];

export function isLoopbackUrl(url: string): boolean {
  try {
    return LOOPBACK_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

export async function resolvePairing(
  deps: SandboxDeps,
  endpoint: StackEndpoint,
  values: EnvValues,
  healthyUrl: string | null,
  signal?: AbortSignal,
): Promise<PairingResolution> {
  let discoveryError: string = SANDBOX_LABELS.pairing.unavailable;
  try {
    const found = await deps.discover({ env: endpoint.env, project: endpoint.project, signal });
    if (found.ok) {
      const { apiUrl, token, name, pairingUrl } = found.config;
      return { ok: true, connection: { apiUrl, token, name, pairingUrl }, message: found.message };
    }
    discoveryError = found.error;
  } catch (error) {
    discoveryError = error instanceof Error ? error.message : String(error);
  }
  const token = values.TESSERACT_TOKEN ?? "";
  if (!isValidToken(token)) return { ok: false, message: discoveryError };
  const apiUrl = healthyUrl ?? (await firstHealthy(deps, endpoint.candidates, signal));
  if (!apiUrl && !endpoint.pairingUrl) return { ok: false, message: discoveryError };
  return {
    ok: true,
    connection: { apiUrl: apiUrl ?? (endpoint.pairingUrl as string), token, name: endpoint.hostname, pairingUrl: endpoint.pairingUrl },
    message: SANDBOX_LABELS.pairing.found(endpoint.hostname, apiUrl ?? (endpoint.pairingUrl as string)),
  };
}

export function pairingInfo(connection: PairedConnection): PairingInfo {
  const url = connection.pairingUrl ?? connection.apiUrl;
  return {
    link: buildPairingLink({ url, token: connection.token, ...(connection.name ? { name: connection.name } : {}) }),
    url,
    name: connection.name,
    local: isLoopbackUrl(url),
  };
}

export async function saveConnection(
  context: SandboxContext,
  connection: PairedConnection,
): Promise<void> {
  if (context.saveConnection) return context.saveConnection(connection);
  await updateConfig(sandboxConfigFile(context), (data) => withConnection(data, connection));
}

export async function readPairing(context: SandboxContext): Promise<PairingInfo> {
  const deps = sandboxDeps(context);
  const values = (await readEnvValues(context.envFile)) ?? {};
  const resolution = await resolvePairing(deps, stackEndpoint(values, context.env), values, null);
  if (!resolution.ok) throw new IpcError("unavailable", resolution.message);
  return pairingInfo(resolution.connection);
}
