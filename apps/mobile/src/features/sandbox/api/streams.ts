import type { CloseInfo, ConnectionState, StreamConnection, StreamOptions } from "@tesseract/client";

import { STREAM_RECONNECT_LIMIT } from "../utils/constants";

/**
 * Log and agent-run streams end with a final message (exit / finished run), so
 * any other close is abnormal: a network drop, a controller restart or its
 * backpressure cut-off. Those reconnect with a fresh ticket and the replay is
 * de-duplicated by seq.
 */
export const RESUMABLE_STREAM_OPTIONS: StreamOptions = { reconnect: true };

export type ReconnectGuard = {
  attach: <T extends StreamConnection>(connection: T) => T;
  onStateChange: (state: ConnectionState) => void;
  onClose: (info: CloseInfo) => void;
};

/**
 * Gives up once a stream has dropped `limit` times in a row without ever
 * opening, e.g. because its process or build no longer exists (a failed
 * upgrade is indistinguishable from a network error in the WebSocket API).
 */
export function createReconnectGuard(limit: number = STREAM_RECONNECT_LIMIT): ReconnectGuard {
  let drops = 0;
  let connection: StreamConnection | null = null;
  return {
    attach: (next) => {
      connection = next;
      return next;
    },
    onStateChange: (state) => {
      if (state === "open") drops = 0;
    },
    onClose: ({ willReconnect }) => {
      if (!willReconnect) return;
      drops += 1;
      if (drops >= limit) connection?.close();
    },
  };
}
