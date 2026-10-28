import type { HostHealth, TerminalInfo } from "@tesseract/protocol";
import { API_PATHS, TICKET_QUERY_PARAM } from "./config";

const DETAILS_TIMEOUT_MS = 3_000;

export type HostTerminalDetails = { hostId: string | null; terminal: TerminalInfo | null };

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(path, { cache: "no-store", signal: AbortSignal.timeout(DETAILS_TIMEOUT_MS) });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

/** What the host daemon's terminal page shows in its strip; reads the terminal with the page's ticket without using it up. */
export async function loadHostTerminal(sessionId: string, ticket: string): Promise<HostTerminalDetails> {
  const [health, terminal] = await Promise.all([
    readJson<HostHealth>(API_PATHS.health),
    readJson<TerminalInfo>(`${API_PATHS.terminal(sessionId)}?${TICKET_QUERY_PARAM}=${encodeURIComponent(ticket)}`),
  ]);
  return { hostId: health?.hostId ?? null, terminal };
}
