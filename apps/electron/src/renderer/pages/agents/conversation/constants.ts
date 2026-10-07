import type { StreamOptions } from "@theone/client";

export const FEED_POLL_INTERVAL_MS = 2500;
export const FEED_STREAM_OPTIONS: StreamOptions = { reconnect: true };

export const HEADER_TICK_MS = 1000;
export const IDLE_TICK_MS = 30_000;

export const COMPOSER_MAX_WIDTH = 760;
export const FOLLOW_UP_MAX_HEIGHT = 200;


export const STATE_GLYPH_SPINNER = 14;
export const SYNC_HEADER_ORDER = ["get", "pull", "revert"] as const;
