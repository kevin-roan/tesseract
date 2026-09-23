import type { Socket } from "bun";

const RFB_BANNER_BYTES = 12;
const RFB_BANNER = /^RFB \d{3}\.\d{3}\n$/;

type Probe = {
  onOpen?: (settle: (value: boolean) => void) => void;
  onData?: (chunk: Uint8Array, settle: (value: boolean) => void) => void;
};

function probe(hostname: string, port: number, timeoutMs: number, handlers: Probe): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let socket: Socket<undefined> | null = null;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket?.end();
      resolve(value);
    };
    const timer = setTimeout(() => settle(false), timeoutMs);
    Bun.connect({
      hostname,
      port,
      socket: {
        open(opened) {
          socket = opened;
          if (settled) opened.end();
          else handlers.onOpen?.(settle);
        },
        data(_socket, chunk) {
          handlers.onData?.(chunk, settle);
        },
        end() {
          settle(false);
        },
        close() {
          settle(false);
        },
        error() {
          settle(false);
        },
        connectError() {
          settle(false);
        },
      },
    }).catch(() => settle(false));
  });
}

/** True when something accepts TCP connections on the port. */
export function probeTcp(hostname: string, port: number, timeoutMs = 1_000): Promise<boolean> {
  return probe(hostname, port, timeoutMs, { onOpen: (settle) => settle(true) });
}

/** True only when an RFB (VNC) server answers with its 12-byte "RFB xxx.yyy\n" version banner in time. */
export function probeRfb(hostname: string, port: number, timeoutMs = 1_000): Promise<boolean> {
  let received = Buffer.alloc(0);
  return probe(hostname, port, timeoutMs, {
    onData: (chunk, settle) => {
      received = Buffer.concat([received, chunk]);
      if (received.byteLength >= RFB_BANNER_BYTES) settle(RFB_BANNER.test(received.subarray(0, RFB_BANNER_BYTES).toString("latin1")));
    },
  });
}
