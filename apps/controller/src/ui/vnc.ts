import RFB from "@novnc/novnc";
import { KeyBar, Overlay, StatusBadge, type ConnectionState } from "./lib/components";
import type { InputMode } from "@tesseract/protocol/bridge";
import {
  API_PATHS,
  DEFAULT_INPUT_MODE,
  FRAGMENT_KEYS,
  HARDWARE_KEYS,
  HOST_MESSAGES,
  KEY_BAR,
  KEYSYMS,
  MESSAGES,
  TEXT_INPUT_RESET_LENGTH,
  TEXT_INPUT_SENTINEL,
  TRACKPAD_OPTIONS,
  VNC_HOST_KEYS,
  VNC_KEYS,
  VNC_OPTIONS,
  VNC_SUBPROTOCOLS,
  type KeyId,
  type VncHostKeyId,
} from "./lib/config";
import { applyInsets, keepFocus, requireElement } from "./lib/dom";
import { takeFragment } from "./lib/fragment";
import { exposeHostApi, hasHost, parseInputMode, postToHost } from "./lib/host";
import { keysymForChar } from "./lib/keys";
import { webSocketUrl } from "./lib/socket";
import { Trackpad } from "./lib/trackpad";

const fragment = takeFragment();
const firstTicket = fragment.get(FRAGMENT_KEYS.ticket);
const password = fragment.get(FRAGMENT_KEYS.password);
const viewOnly = fragment.get(FRAGMENT_KEYS.viewOnly) === "1";
const embedded = hasHost();
let inputMode: InputMode = parseInputMode(fragment.get(FRAGMENT_KEYS.input)) ?? DEFAULT_INPUT_MODE;

const stage = requireElement("[data-stage]");
const bar = requireElement("[data-bar]");
const status = new StatusBadge(requireElement("[data-status]"));
const title = requireElement("[data-title]");
const overlay = new Overlay(requireElement("[data-overlay]"));
const keyboardButton = requireElement<HTMLButtonElement>("[data-keyboard]");
const textInput = requireElement<HTMLTextAreaElement>("[data-text-input]");
const trackpad = new Trackpad(stage, TRACKPAD_OPTIONS);

let rfb: RFB | null = null;
let previousText = TEXT_INPUT_SENTINEL;

function setState(state: ConnectionState, text: string, extra: Record<string, unknown> = {}): void {
  status.set(state, text);
  postToHost({ type: HOST_MESSAGES.vncState, state, inputMode, ...extra });
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
  trackpad.attach(stage.querySelector("canvas"));

  client.addEventListener("connect", () => {
    if (rfb !== client) return;
    setState("connected", MESSAGES.connected);
  });
  client.addEventListener("disconnect", (event) => {
    if (rfb !== client) return;
    rfb = null;
    trackpad.attach(null);
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

function toggleKeyboard(): void {
  if (document.activeElement === textInput) textInput.blur();
  else {
    resetTextInput();
    textInput.focus();
  }
}

function setInputMode(mode: InputMode): void {
  inputMode = mode;
  trackpad.setEnabled(!viewOnly && mode === "trackpad");
}

function pressKey(key: KeyId | VncHostKeyId): void {
  if (key === "ctrl") return;
  if (key === "keyboard") {
    toggleKeyboard();
    return;
  }
  if (key === "browser" || key === "paste") {
    postToHost({ type: HOST_MESSAGES.vncAction, action: key });
    return;
  }
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

const hostKeys = embedded ? VNC_HOST_KEYS.filter((key) => !viewOnly || key.id === "browser") : [];
const keyBar = new KeyBar<KeyId | VncHostKeyId>(requireElement("[data-keys]"), [...hostKeys, ...KEY_BAR], pressKey);

/**
 * Text from the phone's clipboard: becomes the sandbox clipboard (for a later Ctrl+V)
 * and is typed into the focused field, which works even where X selections don't.
 */
function paste(text: string): void {
  if (!rfb || viewOnly) return;
  rfb.clipboardPasteFrom(text);
  for (const char of text.replace(/\r\n?/g, "\n")) rfb.sendKey(keysymForChar(char), null);
}

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

textInput.addEventListener("focus", () => keyBar.setActive("keyboard", true));
textInput.addEventListener("blur", () => keyBar.setActive("keyboard", false));

bar.hidden = embedded;
keepFocus(keyboardButton);
keyboardButton.textContent = MESSAGES.keyboard;
keyboardButton.hidden = viewOnly;
keyboardButton.addEventListener("click", toggleKeyboard);

exposeHostApi({ reconnect: connect, setInputMode, setInsets: applyInsets, paste });
setInputMode(inputMode);
resetTextInput();

if (!firstTicket) {
  setState("error", MESSAGES.missingTicket);
  overlay.show(MESSAGES.missingTicket);
} else {
  connect(firstTicket);
}
