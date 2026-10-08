import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import type { TerminalClientMessage, TerminalServerMessage } from "@tesseract/protocol";
import { KeyBar, Overlay, StatusBadge, type ConnectionState } from "./lib/components";
import {
  API_PATHS,
  APPLICATION_CURSOR_SEQUENCES,
  FRAGMENT_KEYS,
  HOST_MESSAGES,
  KEY_BAR,
  MESSAGES,
  TERMINAL_OPTIONS,
  TERMINAL_SEQUENCES,
  TERMINAL_THEME,
  type KeyId,
} from "./lib/config";
import { requireElement, trackVisualViewport } from "./lib/dom";
import { takeFragment } from "./lib/fragment";
import { exposeHostApi, hasHost, postToHost } from "./lib/host";
import { withCtrl } from "./lib/keys";
import { webSocketUrl } from "./lib/socket";

const fragment = takeFragment();
const sessionId = fragment.get(FRAGMENT_KEYS.session);
const firstTicket = fragment.get(FRAGMENT_KEYS.ticket);

const stage = requireElement("[data-stage]");
const status = new StatusBadge(requireElement("[data-status]"));
const title = requireElement("[data-title]");
const overlay = new Overlay(requireElement("[data-overlay]"));

const term = new Terminal({ ...TERMINAL_OPTIONS, theme: TERMINAL_THEME });
const fit = new FitAddon();
term.loadAddon(fit);
term.open(stage);

let socket: WebSocket | null = null;
const pending: TerminalClientMessage[] = [];

function setState(state: ConnectionState, text: string, extra: Record<string, unknown> = {}): void {
  status.set(state, text);
  postToHost({ type: HOST_MESSAGES.terminalState, state, ...extra });
}

function send(message: TerminalClientMessage): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  else if (message.type === "input") pending.push(message);
}

function refit(): void {
  if (stage.clientWidth > 0 && stage.clientHeight > 0) fit.fit();
}

function requestReconnect(): void {
  if (!hasHost()) {
    overlay.show(MESSAGES.reconnectFromApp);
    return;
  }
  overlay.hide();
  setState("connecting", MESSAGES.connecting);
  postToHost({ type: HOST_MESSAGES.terminalNeedTicket, session: sessionId });
}

function connect(ticket: string): void {
  if (!sessionId) return;
  socket?.close();
  overlay.hide();
  setState("connecting", MESSAGES.connecting);
  const ws = new WebSocket(webSocketUrl(API_PATHS.terminalStream(sessionId), ticket));
  let exited = false;
  socket = ws;

  ws.addEventListener("open", () => {
    term.reset();
    setState("connected", MESSAGES.connected);
    refit();
    send({ type: "resize", cols: term.cols, rows: term.rows });
    for (const message of pending.splice(0)) send(message);
    term.focus();
  });

  ws.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (typeof event.data !== "string") return;
    const message = JSON.parse(event.data) as TerminalServerMessage;
    if (message.type === "output") term.write(message.data);
    else if (message.type === "exit") {
      exited = true;
      setState("exited", MESSAGES.exited, { code: message.code });
      overlay.show(`${MESSAGES.exited}${message.code === null ? "" : ` (exit code ${message.code})`}`);
    }
  });

  ws.addEventListener("close", () => {
    if (socket !== ws || exited) return;
    socket = null;
    setState("disconnected", MESSAGES.disconnected);
    overlay.show(MESSAGES.disconnected, { label: MESSAGES.reconnect, run: requestReconnect });
  });
}

function pressKey(key: KeyId): void {
  if (key === "ctrl") return;
  const sequence = (term.modes.applicationCursorKeysMode ? APPLICATION_CURSOR_SEQUENCES[key] : undefined) ?? TERMINAL_SEQUENCES[key];
  send({ type: "input", data: keyBar.consume("ctrl") ? withCtrl(sequence) : sequence });
  term.focus();
}

const keyBar = new KeyBar(requireElement("[data-keys]"), KEY_BAR, pressKey);

term.onData((data) => send({ type: "input", data: keyBar.consume("ctrl") ? withCtrl(data) : data }));
term.onResize(({ cols, rows }) => send({ type: "resize", cols, rows }));
term.onTitleChange((text) => {
  title.textContent = text;
});

new ResizeObserver(refit).observe(stage);
window.addEventListener("orientationchange", () => setTimeout(refit, 150));
stage.addEventListener("click", () => term.focus());

exposeHostApi({ reconnect: connect });
trackVisualViewport(refit);
refit();

if (!sessionId) {
  setState("error", MESSAGES.missingSession);
  overlay.show(MESSAGES.missingSession);
} else if (!firstTicket) {
  setState("error", MESSAGES.missingTicket);
  overlay.show(MESSAGES.missingTicket);
} else {
  connect(firstTicket);
}
