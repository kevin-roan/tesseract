import type { TerminalConnection, TerminalHandlers, TesseractError } from "@tesseract/client";
import { RESIZE_DEBOUNCE_MS } from "./constants";
import { InputQueue, inputEnabled, mapSocketState } from "./model";
import type { Grid, LiveSession, SessionState } from "./types";

export interface LinkTerminal {
  reset(): void;
  write(data: string): void;
  grid(): Grid;
  setInputEnabled(enabled: boolean): void;
}

export interface LinkTimers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface TerminalLinkOptions {
  open(handlers: TerminalHandlers): TerminalConnection | null;
  terminal: LinkTerminal;
  onChange(patch: Partial<LiveSession>): void;
  timers?: LinkTimers;
}

const defaultTimers: LinkTimers = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class TerminalLink {
  private connection: TerminalConnection | null = null;
  private currentState: SessionState = "connecting";
  private everOpen = false;
  private exitCode: number | null = null;
  private error: string | null = null;
  private readonly queue = new InputQueue();
  private resizeTimer: unknown = null;
  private disposed = false;
  private readonly timers: LinkTimers;

  constructor(private readonly options: TerminalLinkOptions) {
    this.timers = options.timers ?? defaultTimers;
  }

  get state(): SessionState {
    return this.currentState;
  }

  start(): void {
    if (this.connection || this.disposed) return;
    let connection: TerminalConnection | null = null;
    try {
      connection = this.options.open({
        onStateChange: (state) => this.onSocketState(state),
        onError: (error: TesseractError) => {
          this.error = error.message;
          if (this.currentState === "closed") this.emit({ error: this.error });
        },
        onOutput: (data) => this.options.terminal.write(data),
        onExit: (code) => this.markExited(code),
      });
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    }
    if (!connection) {
      this.setState("unavailable");
      return;
    }
    this.connection = connection;
    this.setState(mapSocketState(connection.state === "closed" ? "connecting" : connection.state, false));
  }

  input(data: string): void {
    if (!inputEnabled(this.currentState)) return;
    if (this.currentState === "open" && this.connection) {
      this.connection.send(data);
      return;
    }
    this.queue.push(data);
  }

  gridChanged(): void {
    if (this.resizeTimer !== null) this.timers.clearTimeout(this.resizeTimer);
    this.resizeTimer = this.timers.setTimeout(() => {
      this.resizeTimer = null;
      this.sendResize();
    }, RESIZE_DEBOUNCE_MS);
  }

  reconnect(): void {
    if (this.currentState === "exited" || this.disposed) return;
    if (!this.connection) {
      this.start();
      return;
    }
    this.connection.reconnect();
  }

  markExited(code: number | null): void {
    if (this.currentState === "exited") return;
    this.exitCode = code;
    this.queue.clear();
    this.setState("exited");
  }

  applyServerExit(code: number | null): void {
    if (this.currentState !== "open") this.markExited(code);
  }

  dispose(): void {
    this.disposed = true;
    if (this.resizeTimer !== null) this.timers.clearTimeout(this.resizeTimer);
    this.resizeTimer = null;
    this.queue.clear();
    this.connection?.close();
    this.connection = null;
  }

  private onSocketState(socket: "connecting" | "open" | "closed"): void {
    if (this.currentState === "exited" || this.disposed) return;
    if (socket === "open") {
      this.everOpen = true;
      this.error = null;
      this.options.terminal.reset();
      this.setState("open");
      this.sendResize();
      for (const data of this.queue.drain()) this.connection?.send(data);
      return;
    }
    this.setState(mapSocketState(socket, this.everOpen));
  }

  private sendResize(): void {
    if (this.currentState !== "open" || !this.connection) return;
    const { cols, rows } = this.options.terminal.grid();
    this.connection.resize(cols, rows);
  }

  private setState(state: SessionState): void {
    if (this.currentState === "exited" && state !== "exited") return;
    this.currentState = state;
    this.options.terminal.setInputEnabled(inputEnabled(state));
    this.emit({ state, exitCode: this.exitCode, error: state === "closed" || state === "unavailable" ? this.error : null });
  }

  private emit(patch: Partial<LiveSession>): void {
    this.options.onChange(patch);
  }
}
