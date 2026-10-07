export interface PollerTimers {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export const browserTimers: PollerTimers = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface PollerOptions<T> {
  fetch(signal: AbortSignal): Promise<T>;
  intervalMs: number;
  onResult?(value: T): void;
  onError?(error: unknown): void;
  onLoading?(loading: boolean): void;
  timers?: PollerTimers;
}

export class Poller<T> {
  private timer: unknown = null;
  private inflight: AbortController | null = null;
  private active = false;
  private interval: number;
  private readonly timers: PollerTimers;

  constructor(private readonly options: PollerOptions<T>) {
    this.interval = options.intervalMs;
    this.timers = options.timers ?? browserTimers;
  }

  get running(): boolean {
    return this.active;
  }

  get loading(): boolean {
    return this.inflight !== null;
  }

  get intervalMs(): number {
    return this.interval;
  }

  start(immediate = true): this {
    if (this.active) return this;
    this.active = true;
    if (immediate) this.refresh();
    else this.schedule();
    return this;
  }

  stop(): void {
    this.active = false;
    this.clearTimer();
    const inflight = this.inflight;
    this.inflight = null;
    inflight?.abort();
    this.options.onLoading?.(false);
  }

  refresh(): void {
    this.clearTimer();
    if (this.inflight) return;
    const controller = new AbortController();
    this.inflight = controller;
    this.options.onLoading?.(true);
    void this.run(controller);
  }

  setInterval(intervalMs: number): void {
    this.interval = intervalMs;
    if (this.active && this.timer !== null) this.schedule();
  }

  private async run(controller: AbortController): Promise<void> {
    try {
      const value = await this.options.fetch(controller.signal);
      if (!controller.signal.aborted) this.options.onResult?.(value);
    } catch (error) {
      if (!controller.signal.aborted) this.options.onError?.(error);
    } finally {
      if (this.inflight === controller) {
        this.inflight = null;
        this.options.onLoading?.(false);
        if (this.active) this.schedule();
      }
    }
  }

  private schedule(): void {
    this.clearTimer();
    this.timer = this.timers.set(() => {
      this.timer = null;
      if (this.active) this.refresh();
    }, this.interval);
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    this.timers.clear(this.timer);
    this.timer = null;
  }
}
