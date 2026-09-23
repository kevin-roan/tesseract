import { HOST_MESSAGES } from "./config";

type HostMessage = { type: string } & Record<string, unknown>;

export type HostApi = {
  reconnect: (ticket: string) => void;
};

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(message: string): void };
    theone?: HostApi;
  }
}

export function hasHost(): boolean {
  return Boolean(window.ReactNativeWebView) || window.parent !== window;
}

/** Notifies the embedding app: react-native-webview on phones, the parent window when framed on web. */
export function postToHost(message: HostMessage): void {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
  if (window.parent !== window) window.parent.postMessage(message, "*");
}

/** Exposes `window.theone` for injected JavaScript and accepts the same call as a framed postMessage. */
export function exposeHostApi(api: HostApi): void {
  window.theone = api;
  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    const data = event.data;
    if (typeof data !== "object" || data === null) return;
    const { type, ticket } = data as { type?: unknown; ticket?: unknown };
    if (type === HOST_MESSAGES.reconnect && typeof ticket === "string" && ticket) api.reconnect(ticket);
  });
}
