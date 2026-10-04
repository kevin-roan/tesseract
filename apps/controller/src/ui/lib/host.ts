import { INPUT_MODES, type InputMode, type PageInsets } from "@theone/protocol/bridge";
import { HOST_MESSAGES } from "./config";

type HostMessage = { type: string } & Record<string, unknown>;

export type HostApi = {
  reconnect: (ticket: string) => void;
  setInputMode?: (mode: InputMode) => void;
  setInsets?: (insets: PageInsets) => void;
  paste?: (text: string) => void;
};

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(message: string): void };
    theone?: Required<HostApi>;
  }
}

export function hasHost(): boolean {
  return Boolean(window.ReactNativeWebView) || window.parent !== window;
}

export function parseInputMode(value: unknown): InputMode | null {
  return INPUT_MODES.find((mode) => mode === value) ?? null;
}

const isInset = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

export function parseInsets(value: unknown): PageInsets | null {
  if (typeof value !== "object" || value === null) return null;
  const { top, bottom } = value as { top?: unknown; bottom?: unknown };
  return isInset(top) && isInset(bottom) ? { top, bottom } : null;
}

/** Notifies the embedding app: react-native-webview on phones, the parent window when framed on web. */
export function postToHost(message: HostMessage): void {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
  if (window.parent !== window) window.parent.postMessage(message, "*");
}

/**
 * Exposes `window.theone` for injected JavaScript and accepts the same calls as framed
 * postMessages. Inputs are validated either way; calls a page does not support are no-ops.
 */
export function exposeHostApi(api: HostApi): void {
  const theone = {
    reconnect: (ticket: unknown) => {
      if (typeof ticket === "string" && ticket) api.reconnect(ticket);
    },
    setInputMode: (mode: unknown) => {
      const parsed = parseInputMode(mode);
      if (parsed) api.setInputMode?.(parsed);
    },
    setInsets: (insets: unknown) => {
      const parsed = parseInsets(insets);
      if (parsed) api.setInsets?.(parsed);
    },
    paste: (text: unknown) => {
      if (typeof text === "string" && text) api.paste?.(text);
    },
  };
  window.theone = theone;
  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    const data = event.data;
    if (typeof data !== "object" || data === null) return;
    const message = data as Record<string, unknown>;
    if (message.type === HOST_MESSAGES.reconnect) theone.reconnect(message.ticket);
    else if (message.type === HOST_MESSAGES.inputMode) theone.setInputMode(message.mode);
    else if (message.type === HOST_MESSAGES.insets) theone.setInsets(message);
    else if (message.type === HOST_MESSAGES.paste) theone.paste(message.text);
  });
}
