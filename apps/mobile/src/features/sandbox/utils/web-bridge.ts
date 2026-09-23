import { PAGE_MESSAGES } from "@theone/protocol";

import type { PageConnection, PageKind, PageMessage } from "../types";

const TYPE_PATTERN = /^(vnc|terminal)[-:.](state|need-ticket|exit)$/;

const DROPPED_STATES: ReadonlySet<string> = new Set(["disconnected", "closed"]);

const PAGE_STATES: Record<string, PageConnection> = {
  connected: "connected",
  open: "connected",
  ready: "connected",
  connecting: "connecting",
  reconnecting: "connecting",
  loading: "connecting",
  exited: "exited",
};

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try {
      return asRecord(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  return typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

const exitCodeOf = (record: Record<string, unknown>): number | null => (typeof record.code === "number" ? record.code : null);

export function parsePageMessage(raw: unknown, expected?: PageKind): PageMessage | null {
  const record = asRecord(raw);
  if (!record || typeof record.type !== "string") return null;
  const match = TYPE_PATTERN.exec(record.type);
  if (!match) return null;
  const page = match[1] as PageKind;
  if (expected && page !== expected) return null;
  const kind = match[2];
  if (kind === "need-ticket") return { page, kind };
  if (kind === "exit" || record.state === "exited") return { page, kind: "exit", code: exitCodeOf(record) };
  return typeof record.state === "string" ? { page, kind: "state", state: record.state } : null;
}

export function pageConnectionFor(state: string): PageConnection {
  return PAGE_STATES[state.toLowerCase()] ?? "disconnected";
}

/** The page's socket dropped on its own (not an exit or an auth/config error), so a fresh ticket may bring it back. */
export function isDroppedPageState(state: string): boolean {
  return DROPPED_STATES.has(state.toLowerCase());
}

export function reconnectScript(ticket: string): string {
  return `(function(){var t=window.theone;if(t&&typeof t.reconnect==="function"){t.reconnect(${JSON.stringify(ticket)});}})();true;`;
}

export function reconnectMessage(ticket: string): { type: string; ticket: string } {
  return { type: PAGE_MESSAGES.reconnect, ticket };
}
