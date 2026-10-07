import type { TerminalConnection, TerminalHandlers } from "@theone/client";
import { NetworkError } from "@theone/client";
import { describe, expect, it, vi } from "vitest";
import { TerminalLink, type LinkTerminal, type LinkTimers } from "./link";
import type { LiveSession } from "./types";

function setup() {
  let handlers: TerminalHandlers = {};
  const connection = {
    state: "connecting" as "connecting" | "open" | "closed",
    send: vi.fn(() => true),
    resize: vi.fn(() => true),
    close: vi.fn(),
    reconnect: vi.fn(),
  } satisfies TerminalConnection;
  const terminal: LinkTerminal & { written: string[] } = {
    written: [],
    reset: vi.fn(),
    write(data) {
      this.written.push(data);
    },
    grid: () => ({ cols: 80, rows: 24 }),
    setInputEnabled: vi.fn(),
  };
  const pending: Array<() => void> = [];
  const timers: LinkTimers = {
    setTimeout: (callback) => {
      pending.push(callback);
      return pending.length;
    },
    clearTimeout: (handle) => {
      pending[(handle as number) - 1] = () => undefined;
    },
  };
  const states: Array<Partial<LiveSession>> = [];
  const link = new TerminalLink({
    open: (next) => {
      handlers = next;
      return connection;
    },
    terminal,
    timers,
    onChange: (patch) => states.push(patch),
  });
  link.start();
  return { link, connection, terminal, states, pending, emit: () => handlers };
}

describe("TerminalLink", () => {
  it("resets, resizes and flushes queued input when the socket opens", () => {
    const { link, connection, terminal, emit } = setup();
    expect(link.state).toBe("connecting");
    link.input("ls\r");
    expect(connection.send).not.toHaveBeenCalled();
    emit().onStateChange?.("open");
    expect(terminal.reset).toHaveBeenCalledTimes(1);
    expect(connection.resize).toHaveBeenCalledWith(80, 24);
    expect(connection.send).toHaveBeenCalledWith("ls\r");
    emit().onOutput?.("hello");
    expect(terminal.written).toEqual(["hello"]);
  });

  it("reports reconnecting after the first open and closed with the socket error", () => {
    const { link, emit, states } = setup();
    emit().onStateChange?.("open");
    emit().onStateChange?.("connecting");
    expect(link.state).toBe("reconnecting");
    emit().onError?.(new NetworkError("socket dropped"));
    emit().onStateChange?.("closed");
    expect(link.state).toBe("closed");
    expect(states.at(-1)).toMatchObject({ state: "closed", error: "socket dropped" });
  });

  it("keeps exited sticky and drops input after exit", () => {
    const { link, connection, emit, terminal } = setup();
    emit().onStateChange?.("open");
    emit().onExit?.(3);
    emit().onStateChange?.("closed");
    expect(link.state).toBe("exited");
    expect(terminal.setInputEnabled).toHaveBeenLastCalledWith(false);
    link.input("x");
    expect(connection.send).not.toHaveBeenCalledWith("x");
    link.reconnect();
    expect(connection.reconnect).not.toHaveBeenCalled();
  });

  it("debounces resize frames and only sends them while open", () => {
    const { link, connection, emit, pending } = setup();
    link.gridChanged();
    pending.at(-1)?.();
    expect(connection.resize).not.toHaveBeenCalled();
    emit().onStateChange?.("open");
    connection.resize.mockClear();
    pending.splice(0);
    link.gridChanged();
    link.gridChanged();
    pending.forEach((run) => run());
    expect(connection.resize).toHaveBeenCalledTimes(1);
  });

  it("marks a server-side exit only when the stream is not open", () => {
    const { link, emit } = setup();
    emit().onStateChange?.("open");
    link.applyServerExit(0);
    expect(link.state).toBe("open");
    emit().onStateChange?.("connecting");
    link.applyServerExit(0);
    expect(link.state).toBe("exited");
  });

  it("is unavailable when no socket can be created", () => {
    const states: Array<Partial<LiveSession>> = [];
    const link = new TerminalLink({
      open: () => null,
      terminal: { reset: vi.fn(), write: vi.fn(), grid: () => ({ cols: 1, rows: 1 }), setInputEnabled: vi.fn() },
      onChange: (patch) => states.push(patch),
    });
    link.start();
    expect(link.state).toBe("unavailable");
  });
});
