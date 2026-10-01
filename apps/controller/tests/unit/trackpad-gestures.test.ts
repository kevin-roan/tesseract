import { describe, expect, test } from "bun:test";
import {
  clamp,
  movePointer,
  pointerDelta,
  pointerFromClient,
  pointerScale,
  pointerToClient,
  speedBoost,
  TrackpadGestures,
  wheelDelta,
  type TrackpadAction,
  type TrackpadOptions,
} from "../../src/ui/lib/gestures";

const OPTIONS: TrackpadOptions = {
  tapMs: 250,
  doubleTapMs: 300,
  tapSlop: 8,
  screenFraction: 0.6,
  accelerationStart: 0.3,
  accelerationGain: 1.2,
  maxBoost: 2.5,
  scrollScale: 2,
};

const SCREEN = { left: 10, top: 100, width: 400, height: 250 };

function recognizer(): { gestures: TrackpadGestures; actions: TrackpadAction[]; kinds: () => string[] } {
  const actions: TrackpadAction[] = [];
  const gestures = new TrackpadGestures(OPTIONS, (action) => actions.push(action));
  const kinds = () =>
    actions.map((action) => (action.kind === "button" ? `${action.button}-${action.down ? "down" : "up"}` : action.kind === "click" ? `${action.button}-click` : action.kind));
  return { gestures, actions, kinds };
}

describe("pointer math", () => {
  test("clamp", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
  });

  test("pointerScale maps a full swipe across the pad to a fraction of the screen", () => {
    expect(pointerScale(SCREEN, { left: 0, top: 0, width: 400, height: 700 }, 0.6)).toBeCloseTo(0.6);
    expect(pointerScale({ ...SCREEN, width: 200 }, { left: 0, top: 0, width: 400, height: 700 }, 0.6)).toBeCloseTo(0.3);
    expect(pointerScale(SCREEN, { left: 0, top: 0, width: 0, height: 0 }, 0.6)).toBe(0);
  });

  test("speedBoost is 1 for slow moves and capped for fast ones", () => {
    expect(speedBoost(0, OPTIONS)).toBe(1);
    expect(speedBoost(0.3, OPTIONS)).toBe(1);
    expect(speedBoost(0.8, OPTIONS)).toBeCloseTo(1.6);
    expect(speedBoost(100, OPTIONS)).toBe(2.5);
  });

  test("pointerDelta scales and accelerates, guarding zero dt", () => {
    expect(pointerDelta(10, -5, 100, 0.5, OPTIONS)).toEqual({ x: 5, y: -2.5 });
    const fast = pointerDelta(100, 0, 10, 0.5, OPTIONS);
    expect(fast.x).toBeCloseTo(125);
    expect(pointerDelta(2, 0, 0, 1, OPTIONS).x).toBeGreaterThan(2);
  });

  test("movePointer keeps the pointer on the remote screen", () => {
    expect(movePointer({ x: 0.5, y: 0.5 }, { x: 100, y: -25 }, SCREEN)).toEqual({ x: 0.75, y: 0.4 });
    expect(movePointer({ x: 0.9, y: 0.1 }, { x: 1000, y: -1000 }, SCREEN)).toEqual({ x: 1, y: 0 });
    expect(movePointer({ x: 0.2, y: 0.3 }, { x: 10, y: 10 }, { ...SCREEN, width: 0 })).toEqual({ x: 0.2, y: 0.3 });
  });

  test("client conversions round-trip and clamp", () => {
    expect(pointerToClient({ x: 0.5, y: 0.2 }, SCREEN)).toEqual({ x: 210, y: 150 });
    expect(pointerFromClient({ x: 210, y: 150 }, SCREEN)).toEqual({ x: 0.5, y: 0.2 });
    expect(pointerFromClient({ x: -50, y: 900 }, SCREEN)).toEqual({ x: 0, y: 1 });
    expect(pointerFromClient({ x: 1, y: 1 }, { ...SCREEN, height: 0 })).toEqual({ x: 0.5, y: 0.5 });
  });

  test("wheelDelta scrolls against the fingers", () => {
    expect(wheelDelta(3, -10, 2)).toEqual({ x: -6, y: 20 });
  });
});

describe("TrackpadGestures", () => {
  test("a quick tap is a left click", () => {
    const { gestures, kinds } = recognizer();
    gestures.down(1, { x: 100, y: 100 }, 0);
    gestures.move(1, { x: 103, y: 102 }, 50);
    gestures.up(1, 120);
    expect(kinds()).toEqual(["left-click"]);
  });

  test("a slow press or a drag is not a click", () => {
    const { gestures, kinds } = recognizer();
    gestures.down(1, { x: 100, y: 100 }, 0);
    gestures.up(1, 600);
    expect(kinds()).toEqual([]);
    gestures.down(2, { x: 100, y: 100 }, 1000);
    gestures.move(2, { x: 130, y: 100 }, 1050);
    gestures.up(2, 1100);
    expect(kinds()).toEqual(["move"]);
  });

  test("one-finger moves report deltas from the touch start once past the slop", () => {
    const { gestures, actions } = recognizer();
    gestures.down(1, { x: 100, y: 100 }, 0);
    gestures.move(1, { x: 104, y: 100 }, 16);
    expect(actions).toEqual([]);
    gestures.move(1, { x: 112, y: 100 }, 32);
    gestures.move(1, { x: 120, y: 95 }, 48);
    expect(actions).toEqual([
      { kind: "move", dx: 12, dy: 0, dt: 32 },
      { kind: "move", dx: 8, dy: -5, dt: 16 },
    ]);
  });

  test("two-finger tap is a right click", () => {
    const { gestures, kinds } = recognizer();
    gestures.down(1, { x: 100, y: 100 }, 0);
    gestures.down(2, { x: 160, y: 100 }, 20);
    gestures.up(1, 100);
    gestures.move(2, { x: 200, y: 200 }, 110);
    gestures.up(2, 130);
    expect(kinds()).toEqual(["right-click"]);
  });

  test("two-finger drag scrolls by the centroid and never clicks", () => {
    const { gestures, actions } = recognizer();
    gestures.down(1, { x: 100, y: 100 }, 0);
    gestures.down(2, { x: 200, y: 100 }, 10);
    gestures.move(1, { x: 100, y: 80 }, 30);
    gestures.move(2, { x: 200, y: 80 }, 32);
    gestures.move(1, { x: 100, y: 60 }, 50);
    gestures.up(1, 80);
    gestures.up(2, 90);
    expect(actions).toEqual([
      { kind: "scroll", dx: 0, dy: -10 },
      { kind: "scroll", dx: 0, dy: -10 },
      { kind: "scroll", dx: 0, dy: -10 },
    ]);
  });

  test("tap then press-and-drag holds the left button", () => {
    const { gestures, kinds } = recognizer();
    gestures.down(1, { x: 100, y: 100 }, 0);
    gestures.up(1, 80);
    gestures.down(2, { x: 104, y: 102 }, 200);
    gestures.move(2, { x: 140, y: 102 }, 260);
    gestures.move(2, { x: 160, y: 110 }, 280);
    gestures.up(2, 400);
    expect(kinds()).toEqual(["left-click", "left-down", "move", "move", "left-up"]);
  });

  test("two quick taps are a double click, a late second tap is two clicks without drag", () => {
    const { gestures, kinds } = recognizer();
    gestures.down(1, { x: 100, y: 100 }, 0);
    gestures.up(1, 80);
    gestures.down(1, { x: 100, y: 100 }, 150);
    gestures.up(1, 220);
    expect(kinds()).toEqual(["left-click", "left-click"]);

    const late = recognizer();
    late.gestures.down(1, { x: 100, y: 100 }, 0);
    late.gestures.up(1, 80);
    late.gestures.down(1, { x: 100, y: 100 }, 1000);
    late.gestures.move(1, { x: 150, y: 100 }, 1050);
    late.gestures.up(1, 1100);
    expect(late.kinds()).toEqual(["left-click", "move"]);
  });

  test("a second finger during a drag is ignored and cancel releases the button", () => {
    const { gestures, kinds } = recognizer();
    gestures.down(1, { x: 100, y: 100 }, 0);
    gestures.up(1, 50);
    gestures.down(1, { x: 100, y: 100 }, 100);
    gestures.move(1, { x: 130, y: 100 }, 150);
    gestures.down(2, { x: 300, y: 300 }, 160);
    gestures.move(2, { x: 350, y: 300 }, 170);
    gestures.cancel();
    gestures.up(1, 200);
    expect(kinds()).toEqual(["left-click", "left-down", "move", "left-up"]);
  });

  test("a three-finger touch is neither a click nor a scroll", () => {
    const { gestures, kinds } = recognizer();
    gestures.down(1, { x: 100, y: 100 }, 0);
    gestures.down(2, { x: 150, y: 100 }, 5);
    gestures.down(3, { x: 200, y: 100 }, 10);
    gestures.move(3, { x: 200, y: 200 }, 20);
    gestures.up(1, 50);
    gestures.up(2, 55);
    gestures.up(3, 60);
    expect(kinds()).toEqual([]);
  });
});
