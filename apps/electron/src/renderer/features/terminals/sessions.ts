import type { TheOneClient } from "@theone/client";
import type { TerminalInfo } from "@theone/protocol";
import type { Scheme } from "../../../shared/runtime";
import { MAX_ATTACHED, RECONNECT_DELAY_MS } from "./constants";
import { TerminalLink } from "./link";
import { touchAttached } from "./model";
import { INITIAL_LIVE, useTerminalsUi } from "./store";
import type { TerminalCommand } from "./types";
import { createXtermHost, type TerminalHost, type TerminalHostFactory } from "./xterm-host";

export interface SessionContext {
  client: TheOneClient;
  scheme: Scheme;
  openLink(url: string): void;
  readClipboard(): Promise<string>;
  writeClipboard(text: string): Promise<void>;
}

const RECONNECTABLE = new Set(["reconnecting", "closed", "unavailable"]);

export class AttachedSession {
  readonly host: TerminalHost;
  readonly link: TerminalLink;

  constructor(
    readonly id: string,
    context: SessionContext,
    factory: TerminalHostFactory,
  ) {
    const patch = useTerminalsUi.getState().patchLive;
    patch(id, INITIAL_LIVE);
    this.host = factory(context.scheme, {
      onInput: (data) => this.link.input(data),
      onGrid: (grid) => {
        patch(id, grid);
        this.link.gridChanged();
      },
      onTitle: (title) => patch(id, { title: title || null }),
      onSelection: (hasSelection) => patch(id, { hasSelection }),
      openLink: (url) => context.openLink(url),
      readClipboard: () => context.readClipboard(),
      writeClipboard: (text) => context.writeClipboard(text),
    });
    this.link = new TerminalLink({
      open: (handlers) =>
        context.client.openTerminal(id, handlers, { reconnect: true, minDelayMs: RECONNECT_DELAY_MS.min, maxDelayMs: RECONNECT_DELAY_MS.max }),
      terminal: this.host,
      onChange: (change) => patch(id, change),
    });
    this.link.start();
  }

  run(command: TerminalCommand): void {
    this.host.run(command);
    this.host.focus();
  }

  dispose(): void {
    this.link.dispose();
    this.host.dispose();
  }
}

const sessions = new Map<string, AttachedSession>();
let context: SessionContext | null = null;
let hostFactory: TerminalHostFactory = createXtermHost;

function setAttached(update: (ids: string[]) => string[]): void {
  const ui = useTerminalsUi.getState();
  ui.setAttached(update(ui.attached));
}

export const terminalSessions = {
  configure(next: SessionContext): void {
    if (context && context.client !== next.client) this.disposeAll();
    const schemeChanged = context?.scheme !== next.scheme;
    context = next;
    if (schemeChanged) sessions.forEach((session) => session.host.setScheme(next.scheme));
  },

  get(id: string | null | undefined): AttachedSession | undefined {
    return id ? sessions.get(id) : undefined;
  },

  attach(id: string): AttachedSession | undefined {
    if (!context) return undefined;
    let session = sessions.get(id);
    if (!session) {
      session = new AttachedSession(id, context, hostFactory);
      sessions.set(id, session);
    }
    const ui = useTerminalsUi.getState();
    const { order, evicted } = touchAttached(ui.attached, id, ui.selectedId, MAX_ATTACHED);
    ui.setAttached(order);
    evicted.forEach((victim) => this.detach(victim));
    return session;
  },

  detach(id: string): void {
    sessions.get(id)?.dispose();
    sessions.delete(id);
    setAttached((ids) => ids.filter((candidate) => candidate !== id));
    useTerminalsUi.getState().dropLive(id);
  },

  disposeAll(): void {
    for (const id of [...sessions.keys()]) this.detach(id);
  },

  reconnectStale(): void {
    const live = useTerminalsUi.getState().live;
    sessions.forEach((session, id) => {
      if (RECONNECTABLE.has(live[id]?.state ?? "")) session.link.reconnect();
    });
  },

  applyInfo(info: TerminalInfo): void {
    if (info.state === "exited") sessions.get(info.id)?.link.applyServerExit(info.exitCode);
  },

  setHostFactory(factory: TerminalHostFactory): () => void {
    const previous = hostFactory;
    hostFactory = factory;
    return () => {
      hostFactory = previous;
    };
  },

  reset(): void {
    this.disposeAll();
    context = null;
  },
};
