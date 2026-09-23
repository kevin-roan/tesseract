import RFB from "@novnc/novnc";
import { KeyBar, Overlay, StatusBadge, type ConnectionState } from "./lib/components";
import {
  API_PATHS,
  FRAGMENT_KEYS,
  HARDWARE_KEYS,
  HOST_MESSAGES,
  KEY_BAR,
  KEYSYMS,
  MESSAGES,
  TEXT_INPUT_RESET_LENGTH,
  TEXT_INPUT_SENTINEL,
  VNC_KEYS,
  VNC_OPTIONS,
  VNC_SUBPROTOCOLS,
  type KeyId,
} from "./lib/config";
import { keepFocus, requireElement } from "./lib/dom";
import { takeFragment } from "./lib/fragment";
import { exposeHostApi, hasHost, postToHost } from "./lib/host";
import { keysymForChar } from "./lib/keys";
import { webSocketUrl } from "./lib/socket";

const fragment = takeFragment();
const firstTicket = fragment.get(FRAGMENT_KEYS.ticket);
const password = fragment.get(FRAGMENT_KEYS.password);
const viewOnly = fragment.get(FRAGMENT_KEYS.viewOnly) === "1";

const stage = requireElement("[data-stage]");
const status = new StatusBadge(requireElement("[data-status]"));
const title = requireElement("[data-title]");
const overlay = new Overlay(requireElement("[data-overlay]"));
const keyboardButton = requireElement<HTMLButtonElement>("[data-keyboard]");
const textInput = requireElement<HTMLTextAreaElement>("[data-text-input]");

let rfb: RFB | null = null;
let previousText = TEXT_INPUT_SENTINEL;

function setState(state: ConnectionState, text: string, extra: Record<string, unknown> = {}): void {
  status.set(state, text);
  postToHost({ type: HOST_MESSAGES.vncState, state, ...extra });
}

function requestReconnect(): void {
  if (!hasHost()) {
    overlay.show(MESSAGES.reconnectFromApp);
    return;
  }
  overlay.hide();
  setState("connecting", MESSAGES.connecting);
  postToHost({ type: HOST_MESSAGES.vncNeedTicket });
}

function showDisconnected(reason?: string): void {
  const text = reason ? `${MESSAGES.disconnected}: ${reason}` : MESSAGES.disconnected;
  setState("disconnected", MESSAGES.disconnected, reason ? { reason } : {});
  overlay.show(text, { label: MESSAGES.reconnect, run: requestReconnect });
}

function connect(ticket: string): void {
  rfb?.disconnect();
  overlay.hide();
  setState("connecting", MESSAGES.connecting);
  const client = new RFB(stage, webSocketUrl(API_PATHS.vnc, ticket), {
    credentials: password ? { password } : undefined,
    wsProtocols: VNC_SUBPROTOCOLS,
  });
  client.scaleViewport = true;
  client.resizeSession = false;
  client.viewOnly = viewOnly;
  client.focusOnClick = true;
  client.qualityLevel = VNC_OPTIONS.qualityLevel;
  client.compressionLevel = VNC_OPTIONS.compressionLevel;
  client.background = VNC_OPTIONS.background;
  rfb = client;

  client.addEventListener("connect", () => {
    if (rfb !== client) return;
    setState("connected", MESSAGES.connected);
  });
  client.addEventListener("disconnect", (event) => {
    if (rfb !== client) return;
    rfb = null;
    const clean = (event as CustomEvent<{ clean?: boolean }>).detail?.clean ?? false;
    showDisconnected(clean ? undefined : "connection lost");
  });
  client.addEventListener("credentialsrequired", () => {
    if (password) client.sendCredentials({ password });
    else {
      setState("error", MESSAGES.passwordRequired);
      overlay.show(MESSAGES.passwordRequired);
    }
  });
  client.addEventListener("securityfailure", (event) => {
    const reason = (event as CustomEvent<{ reason?: string }>).detail?.reason;
    setState("error", reason ?? "Authentication failed", { reason });
  });
  client.addEventListener("desktopname", (event) => {
    const name = (event as CustomEvent<{ name?: string }>).detail?.name;
    if (name) title.textContent = name;
  });
}

function sendKeysym(keysym: number, code: string | null): void {
  if (!rfb || viewOnly) return;
  if (keyBar.consume("ctrl")) {
    rfb.sendKey(KEYSYMS.controlLeft, "ControlLeft", true);
    rfb.sendKey(keysym, code);
    rfb.sendKey(KEYSYMS.controlLeft, "ControlLeft", false);
    return;
  }
  rfb.sendKey(keysym, code);
}

function pressKey(key: KeyId): void {
  if (key === "ctrl") return;
  if (key === "ctrl-c") {
    keyBar.consume("ctrl");
    rfb?.sendKey(KEYSYMS.controlLeft, "ControlLeft", true);
    rfb?.sendKey(keysymForChar("c"), "KeyC");
    rfb?.sendKey(KEYSYMS.controlLeft, "ControlLeft", false);
    return;
  }
  const { keysym, code } = VNC_KEYS[key];
  sendKeysym(keysym, code);
}

const keyBar = new KeyBar(requireElement("[data-keys]"), KEY_BAR, pressKey);

function resetTextInput(): void {
  textInput.value = TEXT_INPUT_SENTINEL;
  previousText = TEXT_INPUT_SENTINEL;
}

textInput.addEventListener("input", () => {
  const current = textInput.value;
  let common = 0;
  while (common < previousText.length && common < current.length && previousText[common] === current[common]) common += 1;
  for (let i = common; i < previousText.length; i += 1) sendKeysym(KEYSYMS.backspace, "Backspace");
  for (const char of current.slice(common)) sendKeysym(keysymForChar(char), null);
  if (current.length === 0 || current.length > TEXT_INPUT_RESET_LENGTH) resetTextInput();
  else previousText = current;
});

textInput.addEventListener("keydown", (event) => {
  const keysym = HARDWARE_KEYS[event.key];
  if (keysym === undefined) return;
  event.preventDefault();
  sendKeysym(keysym, event.code || null);
});

keepFocus(keyboardButton);
keyboardButton.textContent = MESSAGES.keyboard;
keyboardButton.hidden = viewOnly;
keyboardButton.addEventListener("click", () => {
  if (document.activeElement === textInput) textInput.blur();
  else {
    resetTextInput();
    textInput.focus();
  }
});

exposeHostApi({ reconnect: connect });
resetTextInput();

if (!firstTicket) {
  setState("error", MESSAGES.missingTicket);
  overlay.show(MESSAGES.missingTicket);
} else {
  connect(firstTicket);
}
