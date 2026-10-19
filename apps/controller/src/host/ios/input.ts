import type { DeviceScreenClientMessage, IosKey } from "@tesseract/protocol";
import { IOS_KEYS } from "@tesseract/protocol";
import { HID_KEYS, IOS_BUTTONS, truncateUtf8 } from "./idb";

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };

/** What the screen session can inject; `IdbClient` today, a gRPC HID stream later (spike: live drag). */
export type IosInput = {
  tap: (x: number, y: number, durationSec?: number) => Promise<void>;
  swipe: (from: Point, to: Point, durationSec: number) => Promise<void>;
  text: (text: string) => Promise<void>;
  key: (usage: number) => Promise<void>;
  button: (name: string) => Promise<void>;
};

export type GestureOptions = {
  /** A touch that moved less than this (points) is a tap. */
  tapSlopPt?: number;
  /** A tap held longer is sent with its duration (long press). */
  longPressMs?: number;
  /** Wheel steps arriving within this window become one swipe. */
  scrollWindowMs?: number;
  /** Points one wheel step scrolls. */
  scrollStepPt?: number;
  /** Commands waiting beyond this are dropped (each `idb ui` call is a process). */
  maxQueued?: number;
  now?: () => number;
  onError?: (error: unknown) => void;
};

type TouchMessage = Extract<DeviceScreenClientMessage, { type: "touch" }>;
type ScrollMessage = Extract<DeviceScreenClientMessage, { type: "scroll" }>;
type Held = { owner: unknown; pointerId: number; start: Point; last: Point; at: number };
type PendingScroll = { at: Point; dx: number; dy: number; timer: ReturnType<typeof setTimeout> };

const TAP_SLOP_PT = 10;
const LONG_PRESS_MS = 500;
const SCROLL_WINDOW_MS = 120;
const SCROLL_STEP_PT = 40;
const SCROLL_DURATION_SEC = 0.15;
const MIN_SWIPE_SEC = 0.05;
const MAX_SWIPE_SEC = 2;
const MAX_QUEUED = 32;

const isIosKey = (key: string): key is IosKey => (IOS_KEYS as readonly string[]).includes(key);
const clamp = (value: number, max: number) => Math.min(Math.max(0, value), max);

/** Maps a point in the viewer's `width × height` space (the frame size it was told) to device points. */
export function toPoints(message: { x: number; y: number; width: number; height: number }, points: Size): Point {
  return {
    x: clamp((message.x * points.width) / message.width, points.width - 1),
    y: clamp((message.y * points.height) / message.height, points.height - 1),
  };
}

/**
 * Turns the Android-style screen messages into whole idb gestures: one pointer per device (others are dropped), a
 * down … up becomes a tap (long press with its duration) or a swipe from the first to the last point, wheel steps
 * become short swipes. Commands run one at a time in order.
 */
export class IosGestures {
  private held: Held | null = null;
  private scroll: PendingScroll | null = null;
  private chain: Promise<void> = Promise.resolve();
  private queued = 0;
  private closed = false;
  private readonly tapSlop: number;
  private readonly longPressMs: number;
  private readonly scrollWindowMs: number;
  private readonly scrollStep: number;
  private readonly maxQueued: number;
  private readonly now: () => number;

  constructor(
    private readonly input: IosInput,
    private readonly points: () => Size | null,
    private readonly options: GestureOptions = {},
  ) {
    this.tapSlop = options.tapSlopPt ?? TAP_SLOP_PT;
    this.longPressMs = options.longPressMs ?? LONG_PRESS_MS;
    this.scrollWindowMs = options.scrollWindowMs ?? SCROLL_WINDOW_MS;
    this.scrollStep = options.scrollStepPt ?? SCROLL_STEP_PT;
    this.maxQueued = options.maxQueued ?? MAX_QUEUED;
    this.now = options.now ?? Date.now;
  }

  /** Waits for every queued command (tests). */
  idle(): Promise<void> {
    return this.chain;
  }

  handle(owner: unknown, message: DeviceScreenClientMessage): void {
    if (this.closed) return;
    switch (message.type) {
      case "touch":
        return this.touch(owner, message);
      case "scroll":
        return this.wheel(message);
      case "key":
        return this.key(message.key);
      case "text": {
        const text = truncateUtf8(message.text);
        if (text) this.enqueue(() => this.input.text(text));
        return;
      }
      case "rotate":
        return;
    }
  }

  /** A viewer left: the gesture it holds is dropped, not injected. */
  release(owner: unknown): void {
    if (this.held?.owner === owner) this.held = null;
  }

  close(): void {
    this.closed = true;
    this.held = null;
    if (this.scroll) clearTimeout(this.scroll.timer);
    this.scroll = null;
  }

  private touch(owner: unknown, message: TouchMessage): void {
    const points = this.points();
    if (!points) return;
    const at = toPoints(message, points);
    const held = this.held;
    if (message.action === "down") {
      if (!held) this.held = { owner, pointerId: message.pointerId, start: at, last: at, at: this.now() };
      return;
    }
    if (!held || held.owner !== owner || held.pointerId !== message.pointerId) return;
    if (message.action === "move") {
      held.last = at;
      return;
    }
    this.held = null;
    if (message.action === "cancel") return;
    const elapsed = this.now() - held.at;
    const distance = Math.hypot(at.x - held.start.x, at.y - held.start.y);
    if (distance < this.tapSlop) {
      const duration = elapsed >= this.longPressMs ? elapsed / 1000 : undefined;
      this.enqueue(() => this.input.tap(held.start.x, held.start.y, duration));
      return;
    }
    const duration = Math.min(MAX_SWIPE_SEC, Math.max(MIN_SWIPE_SEC, elapsed / 1000));
    this.enqueue(() => this.input.swipe(held.start, at, duration));
  }

  /** Positive `vscroll` scrolls up (content moves down), as on Android: the finger moves down. */
  private wheel(message: ScrollMessage): void {
    const points = this.points();
    if (!points) return;
    if (!this.scroll) {
      const pending: PendingScroll = {
        at: toPoints(message, points),
        dx: 0,
        dy: 0,
        timer: setTimeout(() => this.flushScroll(pending, points), this.scrollWindowMs),
      };
      this.scroll = pending;
    }
    this.scroll.dx += message.hscroll;
    this.scroll.dy += message.vscroll;
  }

  private flushScroll(pending: PendingScroll, points: Size): void {
    if (this.scroll !== pending) return;
    this.scroll = null;
    const to = {
      x: clamp(pending.at.x + pending.dx * this.scrollStep, points.width - 1),
      y: clamp(pending.at.y + pending.dy * this.scrollStep, points.height - 1),
    };
    if (Math.hypot(to.x - pending.at.x, to.y - pending.at.y) < 1) return;
    this.enqueue(() => this.input.swipe(pending.at, to, SCROLL_DURATION_SEC));
  }

  private key(key: string): void {
    if (!isIosKey(key)) return;
    const button = IOS_BUTTONS[key];
    if (button) {
      this.enqueue(() => this.input.button(button));
      return;
    }
    const usage = HID_KEYS[key];
    if (usage !== undefined) this.enqueue(() => this.input.key(usage));
  }

  private enqueue(command: () => Promise<void>): void {
    if (this.queued >= this.maxQueued) return;
    this.queued += 1;
    this.chain = this.chain
      .then(() => (this.closed ? undefined : command()))
      .catch((error: unknown) => this.options.onError?.(error))
      .finally(() => {
        this.queued -= 1;
      });
  }
}
