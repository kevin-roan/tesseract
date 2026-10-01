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
  vncAction: "vnc-action",
  reconnect: "theone-reconnect",
  inputMode: "theone-input-mode",
  insets: "theone-insets",
} as const;
export type PageMessageType = (typeof PAGE_MESSAGES)[keyof typeof PAGE_MESSAGES];

/** Values of `state` in `*-state` messages. */
export const PAGE_STATES = ["connecting", "connected", "disconnected", "exited", "error"] as const;
export type PageState = (typeof PAGE_STATES)[number];

/** How touches on the VNC page drive the remote pointer: a laptop-style touchpad or direct touch. */
export const INPUT_MODES = ["trackpad", "touch"] as const;
export type InputMode = (typeof INPUT_MODES)[number];

/** Payload of `theone-insets`: CSS px the app's floating chrome covers at the top and bottom of the page. */
export type PageInsets = { top: number; bottom: number };

/** Values of `action` in `vnc-action` messages. */
export const VNC_ACTIONS = ["browser"] as const;
export type VncAction = (typeof VNC_ACTIONS)[number];
