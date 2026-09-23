/**
 * postMessage names between the controller's /ui pages and the app embedding them
 * (react-native-webview on phones, an iframe on web). Kept free of zod so the
 * browser pages can import it without pulling in the schemas.
 */
export const PAGE_MESSAGES = {
  terminalState: "terminal-state",
  terminalNeedTicket: "terminal-need-ticket",
  vncState: "vnc-state",
  vncNeedTicket: "vnc-need-ticket",
  reconnect: "theone-reconnect",
} as const;
export type PageMessageType = (typeof PAGE_MESSAGES)[keyof typeof PAGE_MESSAGES];

/** Values of `state` in `*-state` messages. */
export const PAGE_STATES = ["connecting", "connected", "disconnected", "exited", "error"] as const;
export type PageState = (typeof PAGE_STATES)[number];
