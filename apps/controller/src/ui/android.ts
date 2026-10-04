import type { AndroidKey, AndroidScreenClientMessage, AndroidScreenServerMessage } from "@theone/protocol";
import { KeyBar, Overlay, StatusBadge, type ConnectionState } from "./lib/components";
import {
  ANDROID_BAR,
  ANDROID_HARDWARE_KEYS,
  ANDROID_INPUT,
  API_PATHS,
  FRAGMENT_KEYS,
  HOST_MESSAGES,
  MESSAGES,
  TEXT_INPUT_RESET_LENGTH,
  TEXT_INPUT_SENTINEL,
  type AndroidBarKeyId,
} from "./lib/config";
import { applyInsets, requireElement } from "./lib/dom";
import { takeFragment } from "./lib/fragment";
import { FrameCanvas } from "./lib/frame-canvas";
import { exposeHostApi, hasHost, postToHost } from "./lib/host";
import { PointerSlots } from "./lib/pointer-slots";
import { webSocketUrl } from "./lib/socket";

const fragment = takeFragment();
const firstTicket = fragment.get(FRAGMENT_KEYS.ticket);
const maxSize = Number(fragment.get(FRAGMENT_KEYS.maxSize) ?? "");
const embedded = hasHost();

const stage = requireElement("[data-stage]");
const canvas = requireElement<HTMLCanvasElement>("[data-screen]");
const status = new StatusBadge(requireElement("[data-status]"));
const title = requireElement("[data-title]");
const overlay = new Overlay(requireElement("[data-overlay]"));
const textInput = requireElement<HTMLTextAreaElement>("[data-text-input]");
const screen = new FrameCanvas(stage, canvas);
const pointers = new PointerSlots(ANDROID_INPUT.maxPointers);

let socket: WebSocket | null = null;
let previousText = TEXT_INPUT_SENTINEL;

function setState(state: ConnectionState, text: string, extra: Record<string, unknown> = {}): void {
  status.set(state, text);
  postToHost({ type: HOST_MESSAGES.androidState, state, ...extra });
}

function requestReconnect(): void {
  if (!hasHost()) {
    overlay.show(MESSAGES.reconnectFromApp);
    return;
  }
  overlay.hide();
  setState("connecting", MESSAGES.connecting);
  postToHost({ type: HOST_MESSAGES.androidNeedTicket });
}

function showDisconnected(reason: string | null): void {
  setState("disconnected", MESSAGES.disconnected, reason ? { reason } : {});
  overlay.show(reason ? `${MESSAGES.disconnected}: ${reason}` : MESSAGES.disconnected, { label: MESSAGES.reconnect, run: requestReconnect });
}

/** The daemon refused or ended the stream on purpose: no automatic retry, only the button. */
function showServerError(message: string): void {
  setState("error", message, { reason: message });
  overlay.show(message, { label: MESSAGES.reconnect, run: requestReconnect });
}

function send(message: AndroidScreenClientMessage): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function receive(message: AndroidScreenServerMessage): string | null {
  if (message.type === "error") return message.message;
  if (message.type === "meta") {
    title.textContent = message.deviceName || MESSAGES.androidTitle;
    setState("connected", MESSAGES.connected);
  }
  screen.setScreenSize({ width: message.width, height: message.height });
  return null;
}

function connect(ticket: string): void {
  const previous = socket;
  socket = null;
  previous?.close();
  overlay.hide();
  setState("connecting", MESSAGES.connecting);
  const query = Number.isInteger(maxSize) && maxSize > 0 ? `&${FRAGMENT_KEYS.maxSize}=${maxSize}` : "";
  const ws = new WebSocket(`${webSocketUrl(API_PATHS.androidScreen, ticket)}${query}`);
  ws.binaryType = "arraybuffer";
  socket = ws;
  let serverError: string | null = null;
  ws.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (socket !== ws) return;
    if (event.data instanceof ArrayBuffer) {
      screen.push(event.data);
      return;
    }
    if (typeof event.data !== "string") return;
    try {
      serverError = receive(JSON.parse(event.data) as AndroidScreenServerMessage) ?? serverError;
    } catch {}
  });
  ws.addEventListener("close", (event) => {
    if (socket !== ws) return;
    socket = null;
    pointers.releaseAll();
    if (serverError) showServerError(serverError);
    else showDisconnected(event.wasClean ? null : "connection lost");
  });
}

function point(event: { clientX: number; clientY: number }) {
  const size = screen.screenSize;
  const position = screen.toScreen(event.clientX, event.clientY);
  return size && position ? { ...position, width: size.width, height: size.height } : null;
}

function touch(action: "down" | "move" | "up" | "cancel", pointerId: number, event: PointerEvent): void {
  const position = point(event);
  if (position) send({ type: "touch", action, pointerId, ...position, pressure: action === "up" ? 0 : 1 });
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const slot = pointers.acquire(event.pointerId);
  if (slot === null) return;
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {}
  touch("down", slot, event);
});

canvas.addEventListener("pointermove", (event) => {
  const slot = pointers.get(event.pointerId);
  if (slot === null) return;
  event.preventDefault();
  touch("move", slot, event);
});

const endPointer = (action: "up" | "cancel") => (event: PointerEvent) => {
  const slot = pointers.release(event.pointerId);
  if (slot === null) return;
  event.preventDefault();
  touch(action, slot, event);
};
canvas.addEventListener("pointerup", endPointer("up"));
canvas.addEventListener("pointercancel", endPointer("cancel"));
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

const clampScroll = (value: number) => Math.max(-ANDROID_INPUT.maxScroll, Math.min(ANDROID_INPUT.maxScroll, value));

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const position = point(event);
    if (!position) return;
    const step = event.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? ANDROID_INPUT.wheelPixelsPerStep : ANDROID_INPUT.wheelLinesPerStep;
    const hscroll = clampScroll(event.deltaX / step);
    const vscroll = clampScroll(-event.deltaY / step);
    if (hscroll || vscroll) send({ type: "scroll", ...position, hscroll, vscroll });
  },
  { passive: false },
);

function sendKey(key: AndroidKey): void {
  send({ type: "key", key });
}

const utf8Length = (codePoint: number) => (codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4);

/** Chunks of at most `maxTextBytes` UTF-8 bytes, never splitting a code point (or a surrogate pair). */
function sendText(text: string): void {
  let chunk = "";
  let bytes = 0;
  for (const char of text) {
    const size = utf8Length(char.codePointAt(0) ?? 0);
    if (bytes + size > ANDROID_INPUT.maxTextBytes) {
      send({ type: "text", text: chunk });
      chunk = "";
      bytes = 0;
    }
    chunk += char;
    bytes += size;
  }
  if (chunk) send({ type: "text", text: chunk });
}

function resetTextInput(): void {
  textInput.value = TEXT_INPUT_SENTINEL;
  previousText = TEXT_INPUT_SENTINEL;
}

function toggleKeyboard(): void {
  if (document.activeElement === textInput) textInput.blur();
  else {
    resetTextInput();
    textInput.focus();
  }
}

function pressBarKey(key: AndroidBarKeyId): void {
  if (key === "keyboard") toggleKeyboard();
  else if (key === "rotate") send({ type: "rotate" });
  else sendKey(key);
}

const bar = new KeyBar<AndroidBarKeyId>(requireElement("[data-keys]"), ANDROID_BAR, pressBarKey);

textInput.addEventListener("input", () => {
  const current = textInput.value;
  let common = 0;
  while (common < previousText.length && common < current.length && previousText[common] === current[common]) common += 1;
  for (let i = common; i < previousText.length; i += 1) sendKey("del");
  const inserted = current.slice(common);
  const lines = inserted.split("\n");
  lines.forEach((line, index) => {
    if (index > 0) sendKey("enter");
    if (line) sendText(line);
  });
  if (current.length === 0 || current.length > TEXT_INPUT_RESET_LENGTH) resetTextInput();
  else previousText = current;
});

textInput.addEventListener("keydown", (event) => {
  const key = ANDROID_HARDWARE_KEYS[event.key];
  if (!key) return;
  event.preventDefault();
  sendKey(key);
});

textInput.addEventListener("focus", () => bar.setActive("keyboard", true));
textInput.addEventListener("blur", () => bar.setActive("keyboard", false));

requireElement("[data-bar]").hidden = embedded;
exposeHostApi({ reconnect: connect, setInsets: applyInsets });
resetTextInput();

if (!firstTicket) {
  setState("error", MESSAGES.missingTicket);
  overlay.show(MESSAGES.missingTicket);
} else {
  connect(firstTicket);
}
