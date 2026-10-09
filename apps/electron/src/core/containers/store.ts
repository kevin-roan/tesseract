import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { DomainRoute } from "../../shared/contracts/containers";

export interface TunnelRecord {
  accountId: string;
  tunnelId: string;
}

export interface StoredRoute extends DomainRoute {
  zoneId: string;
  recordId: string | null;
}

export interface ContainersState {
  tunnels: Record<string, TunnelRecord>;
  routes: StoredRoute[];
}

export const EMPTY_STATE: ContainersState = { tunnels: {}, routes: [] };

export async function readState(file: string): Promise<ContainersState> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as Partial<ContainersState>;
    return { tunnels: parsed.tunnels ?? {}, routes: Array.isArray(parsed.routes) ? parsed.routes : [] };
  } catch {
    return { tunnels: {}, routes: [] };
  }
}

export async function writeState(file: string, state: ContainersState): Promise<void> {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temp, file);
}

export function publicRoute({ zoneId: _zone, recordId: _record, ...route }: StoredRoute): DomainRoute {
  return route;
}
