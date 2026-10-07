import { PAGE_MESSAGES, VNC_ACTIONS, type InputMode, type VncAction } from "@theone/protocol";

import type { PageConnection, PageInsets, PageKind, PageMessage } from "../types";

const TYPE_PATTERN = /^(vnc|terminal|android)[-:.](state|need-ticket|exit|action)$/;

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

const isVncAction = (value: unknown): value is VncAction => (VNC_ACTIONS as readonly unknown[]).includes(value);

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
  if (kind === "action") return isVncAction(record.action) ? { page, kind, action: record.action } : null;
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

/** Calls `window.theone[method](argument)` inside the page, doing nothing when the page has no such bridge function. */
function pageCallScript(method: string, argument: unknown): string {
  return `(function(){var t=window.theone;if(t&&typeof t.${method}==="function"){t.${method}(${JSON.stringify(argument)});}})();true;`;
}

export function reconnectScript(ticket: string): string {
  return pageCallScript("reconnect", ticket);
}

export function insetsScript(insets: PageInsets): string {
  return pageCallScript("setInsets", insets);
}

export function insetsMessage({ top, bottom }: PageInsets): { type: string; top: number; bottom: number } {
  return { type: PAGE_MESSAGES.insets, top, bottom };
}

export function immersiveScript(immersive: boolean): string {
  return pageCallScript("setImmersive", immersive);
}

export function immersiveMessage(immersive: boolean): { type: string; immersive: boolean } {
  return { type: PAGE_MESSAGES.immersive, immersive };
}

export function inputModeScript(mode: InputMode): string {
  return pageCallScript("setInputMode", mode);
}

export function inputModeMessage(mode: InputMode): { type: string; mode: InputMode } {
  return { type: PAGE_MESSAGES.inputMode, mode };
}

export function reconnectMessage(ticket: string): { type: string; ticket: string } {
  return { type: PAGE_MESSAGES.reconnect, ticket };
}

export function pasteScript(text: string): string {
  return pageCallScript("paste", text);
}

export function pasteMessage(text: string): { type: string; text: string } {
  return { type: PAGE_MESSAGES.paste, text };
}
