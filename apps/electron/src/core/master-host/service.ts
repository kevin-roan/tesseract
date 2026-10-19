import type { FetchLike } from "@tesseract/client";
import type { ConnectionConfig } from "../../shared/contracts/connection";
import type { MasterHostState } from "../../shared/contracts/masterHost";
import type { ConfigData } from "../config";
import type { TokenCipher } from "../connection/token-vault";
import { healthUrl, isHostHealth } from "../host/model";
import { MASTER_HOST_HEALTH_TIMEOUT_MS } from "./constants";
import { isLocalConnection, masterHostState, readMasterHost } from "./model";

export async function probeMasterHost(url: string, fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike): Promise<boolean> {
  try {
    const response = await fetchImpl(healthUrl(url), {
      method: "GET",
      headers: {},
      signal: AbortSignal.timeout(MASTER_HOST_HEALTH_TIMEOUT_MS),
    });
    if (!response.ok) return false;
    return isHostHealth(JSON.parse(await response.text()));
  } catch {
    return false;
  }
}

export interface MasterHostStateInput {
  config: ConnectionConfig | null;
  data: ConfigData;
  cipher: TokenCipher | null;
  local?: boolean;
  fetch?: FetchLike;
}

export async function resolveMasterHostState(input: MasterHostStateInput): Promise<MasterHostState> {
  const { config } = input;
  const local = config !== null && (input.local ?? isLocalConnection(config));
  if (!config || local) return masterHostState(config, null, false, local);
  const saved = readMasterHost(input.data, config.apiUrl, input.cipher);
  const online = saved ? await probeMasterHost(saved.url, input.fetch) : false;
  return masterHostState(config, saved, online, false);
}
