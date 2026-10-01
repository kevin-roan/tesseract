export type Point = { x: number; y: number };
export type Rect = { left: number; top: number; width: number; height: number };
export type MouseButton = "left" | "right";

export type TrackpadOptions = {
  tapMs: number;
  doubleTapMs: number;
  tapSlop: number;
  screenFraction: number;
  accelerationStart: number;
  accelerationGain: number;
  maxBoost: number;
  scrollScale: number;
};

export type TrackpadAction =
  | { kind: "move"; dx: number; dy: number; dt: number }
  | { kind: "button"; button: MouseButton; down: boolean }
  | { kind: "click"; button: MouseButton }
  | { kind: "scroll"; dx: number; dy: number };

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Client px of pointer travel per px of finger travel, so crossing the pad moves `screenFraction` of the screen. */
export function pointerScale(screen: Rect, pad: Rect, screenFraction: number): number {
  return pad.width > 0 ? (screenFraction * screen.width) / pad.width : 0;
}

/** Multiplier for fast swipes: 1 below `accelerationStart` px/ms, growing linearly up to `maxBoost`. */
export function speedBoost(speed: number, options: TrackpadOptions): number {
  return 1 + clamp((speed - options.accelerationStart) * options.accelerationGain, 0, options.maxBoost - 1);
}

export function pointerDelta(dx: number, dy: number, dt: number, scale: number, options: TrackpadOptions): Point {
  const factor = scale * speedBoost(Math.hypot(dx, dy) / Math.max(dt, 1), options);
  return { x: dx * factor, y: dy * factor };
}

/** Moves a pointer kept as a 0..1 fraction of the remote screen by a delta in client px. */
export function movePointer(position: Point, delta: Point, screen: Rect): Point {
  if (screen.width <= 0 || screen.height <= 0) return position;
  return {
    x: clamp(position.x + delta.x / screen.width, 0, 1),
    y: clamp(position.y + delta.y / screen.height, 0, 1),
  };
}

export function pointerFromClient(point: Point, screen: Rect): Point {
  if (screen.width <= 0 || screen.height <= 0) return { x: 0.5, y: 0.5 };
  return {
    x: clamp((point.x - screen.left) / screen.width, 0, 1),
    y: clamp((point.y - screen.top) / screen.height, 0, 1),
  };
}

export function pointerToClient(position: Point, screen: Rect): Point {
  return { x: screen.left + position.x * screen.width, y: screen.top + position.y * screen.height };
}

/** Natural scrolling: content follows the fingers, so the wheel turns against them. */
export function wheelDelta(dx: number, dy: number, scale: number): Point {
  return { x: -dx * scale, y: -dy * scale };
}

type Contact = { start: Point; last: Point };

/**
 * Turns raw touch contacts into laptop touchpad actions: one-finger move, tap = left
 * click, two-finger tap = right click, two-finger drag = scroll, tap then press and
 * drag = left-button drag.
 */
export class TrackpadGestures {
  private readonly contacts = new Map<number, Contact>();
  private mode: "idle" | "one" | "two" | "done" = "idle";
  private primary = -1;
  private startedAt = 0;
  private lastMoveAt = 0;
  private moved = false;
  private dragArmed = false;
  private dragging = false;
  private anchor: Point = { x: 0, y: 0 };
  private lastTap: { at: number; point: Point } | null = null;

  constructor(
    private readonly options: TrackpadOptions,
    private readonly emit: (action: TrackpadAction) => void,
  ) {}

  down(id: number, point: Point, at: number): void {
    if (this.contacts.has(id)) return;
    this.contacts.set(id, { start: point, last: point });
    if (this.mode === "idle") {
      this.mode = "one";
      this.primary = id;
      this.startedAt = at;
      this.lastMoveAt = at;
      this.moved = false;
      this.dragArmed =
        this.lastTap !== null &&
        at - this.lastTap.at <= this.options.doubleTapMs &&
        distance(point, this.lastTap.point) <= this.options.tapSlop * 3;
      return;
    }
    if (this.mode === "one" && !this.dragging && this.contacts.size === 2) {
      this.mode = "two";
      this.anchor = this.centroid();
      return;
    }
    this.moved = true;
  }

  move(id: number, point: Point, at: number): void {
    const contact = this.contacts.get(id);
    if (!contact) return;
    const previous = contact.last;
    contact.last = point;
    if (this.mode === "one" && id === this.primary) this.moveOne(contact, previous, at);
    else if (this.mode === "two" && this.contacts.size === 2) this.moveTwo();
  }

  up(id: number, at: number): void {
    const contact = this.contacts.get(id);
    if (!contact) return;
    this.contacts.delete(id);
    if (this.mode === "one" && id === this.primary) {
      if (this.dragging) this.emit({ kind: "button", button: "left", down: false });
      const tapped = !this.dragging && !this.moved && at - this.startedAt <= this.options.tapMs;
      if (tapped) this.emit({ kind: "click", button: "left" });
      this.lastTap = tapped ? { at, point: contact.start } : null;
      this.dragging = false;
      this.mode = "done";
    }
    if (this.contacts.size > 0) return;
    if (this.mode === "two" && !this.moved && at - this.startedAt <= this.options.tapMs) {
      this.emit({ kind: "click", button: "right" });
    }
    if (this.mode === "two") this.lastTap = null;
    this.mode = "idle";
  }

  cancel(): void {
    if (this.dragging) this.emit({ kind: "button", button: "left", down: false });
    this.contacts.clear();
    this.dragging = false;
    this.lastTap = null;
    this.mode = "idle";
  }

  private moveOne(contact: Contact, previous: Point, at: number): void {
    if (!this.moved && distance(contact.start, contact.last) <= this.options.tapSlop) return;
    const from = this.moved ? previous : contact.start;
    this.moved = true;
    if (this.dragArmed && !this.dragging) {
      this.dragging = true;
      this.emit({ kind: "button", button: "left", down: true });
    }
    const dt = at - this.lastMoveAt;
    this.lastMoveAt = at;
    this.emit({ kind: "move", dx: contact.last.x - from.x, dy: contact.last.y - from.y, dt });
  }

  private moveTwo(): void {
    const center = this.centroid();
    if (!this.moved && distance(center, this.anchor) <= this.options.tapSlop) return;
    this.moved = true;
    this.emit({ kind: "scroll", dx: center.x - this.anchor.x, dy: center.y - this.anchor.y });
    this.anchor = center;
  }

  private centroid(): Point {
    let x = 0;
    let y = 0;
    for (const { last } of this.contacts.values()) {
      x += last.x;
      y += last.y;
    }
    const count = Math.max(this.contacts.size, 1);
    return { x: x / count, y: y / count };
  }
}
