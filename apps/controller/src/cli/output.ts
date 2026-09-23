export type Output = {
  out: (text: string) => void;
  err: (text: string) => void;
  /** Writes bytes to stdout as-is; absent when stdout is a terminal. */
  raw?: (bytes: Uint8Array) => Promise<void>;
};

let pending: Promise<unknown> = Promise.resolve();

function enqueue(write: () => Promise<unknown>): Promise<void> {
  pending = pending.then(write).catch(() => undefined);
  return pending.then(() => undefined);
}

export const consoleOutput: Output = {
  out: (text) => void enqueue(() => Bun.write(Bun.stdout, `${text}\n`)),
  err: (text) => void enqueue(() => Bun.write(Bun.stderr, `${text}\n`)),
  ...(process.stdout.isTTY ? {} : { raw: (bytes: Uint8Array) => enqueue(() => Bun.write(Bun.stdout, bytes)) }),
};

/** process.exit() drops whatever a pipe has not taken yet (anything past 64 KiB); await this first. */
export function flushOutput(): Promise<void> {
  return enqueue(async () => undefined);
}
