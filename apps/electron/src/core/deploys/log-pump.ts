import { LIMITS } from "@tesseract/protocol";

export class LogPump {
  private pending = "";
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly send: (chunk: string) => Promise<void>,
    private readonly delayMs: number,
  ) {}

  push(line: string): void {
    this.pending += `${line}\n`;
    if (this.pending.length > LIMITS.maxDeployLogLength) this.pending = this.pending.slice(-LIMITS.maxDeployLogLength);
    this.timer ??= setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.delayMs);
  }

  flush(): void {
    const chunk = this.take();
    if (!chunk) return;
    this.chain = this.chain.then(() => this.send(chunk)).catch(() => undefined);
  }

  take(): string {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    const chunk = this.pending;
    this.pending = "";
    return chunk;
  }

  async settle(): Promise<void> {
    let current: Promise<void>;
    do {
      current = this.chain;
      await current;
    } while (current !== this.chain);
  }
}
